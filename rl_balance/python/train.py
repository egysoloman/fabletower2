from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path

import numpy as np
import torch

from model import EntityActorCritic
from protocol import VectorPool, set_worker_threads


def args_parser() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Independent masked-PPO trainer for NEONSPIRE")
    p.add_argument("--output", required=True)
    p.add_argument("--character", default="all", choices=["all", "runner", "vector", "ghost", "array"])
    p.add_argument("--ascension", type=int, default=0)
    p.add_argument("--style", type=int, default=0, choices=range(8))
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--minutes", type=float, default=48)
    p.add_argument("--envs", type=int, default=256)
    p.add_argument("--sim-workers", type=int, default=4)
    p.add_argument("--rollout-steps", type=int, default=128)
    p.add_argument("--minibatch", type=int, default=4096)
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--gamma", type=float, default=0.997)
    p.add_argument("--gae-lambda", type=float, default=0.95)
    p.add_argument("--clip", type=float, default=0.2)
    p.add_argument("--entropy", type=float, default=0.01)
    p.add_argument("--config", default=None)
    p.add_argument("--device", default="cuda")
    p.add_argument("--save-every", type=int, default=10)
    return p.parse_args()


def checkpoint(path: Path, model, optimizer, args, update: int, steps: int, meta: dict) -> None:
    torch.save({
        "model": model.state_dict(),
        "optimizer": optimizer.state_dict(),
        "args": vars(args),
        "update": update,
        "steps": steps,
        "meta": meta,
    }, path)


def main() -> None:
    args = args_parser()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    (output / "train_args.json").write_text(json.dumps(vars(args), indent=2), encoding="utf-8")
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
        torch.backends.cuda.matmul.allow_tf32 = True
    device = torch.device(args.device if torch.cuda.is_available() else "cpu")
    set_worker_threads(max(1, args.sim_workers))

    pool = VectorPool(
        args.envs, args.sim_workers,
        character=args.character,
        ascension=args.ascension,
        seed_base=args.seed * 10_000_019,
        style=args.style,
        config=args.config,
        log_dir=str(output / "train_episodes"),
    )
    model = EntityActorCritic(pool.global_dim, pool.action_dim, pool.action_feat_dim).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr, eps=1e-5)
    frame = pool.frame
    deadline = time.monotonic() + args.minutes * 60
    update = 0
    total_steps = 0
    recent_reward = 0.0
    recent_episodes = 0
    started = time.monotonic()
    try:
        while time.monotonic() < deadline:
            update += 1
            n, t, d, a = pool.total_envs, args.rollout_steps, pool.obs_dim, pool.action_dim
            obs_buf = np.empty((t, n, d), dtype=np.float16)
            mask_buf = np.empty((t, n, a), dtype=np.bool_)
            act_buf = np.empty((t, n), dtype=np.int16)
            logp_buf = np.empty((t, n), dtype=np.float32)
            val_buf = np.empty((t, n), dtype=np.float32)
            rew_buf = np.empty((t, n), dtype=np.float32)
            done_buf = np.empty((t, n), dtype=np.bool_)

            model.eval()
            for step in range(t):
                obs_buf[step] = frame.obs
                mask_buf[step] = frame.masks
                with torch.inference_mode():
                    obs_t = torch.from_numpy(frame.obs).to(device)
                    mask_t = torch.from_numpy(frame.masks).to(device)
                    dist, value = model.distribution(obs_t, mask_t)
                    action = dist.sample()
                    logp = dist.log_prob(action)
                actions = action.cpu().numpy().astype(np.int16)
                act_buf[step] = actions
                logp_buf[step] = logp.cpu().numpy()
                val_buf[step] = value.cpu().numpy()
                frame = pool.step(actions)
                rew_buf[step] = frame.rewards
                done_buf[step] = frame.dones
                recent_reward += float(frame.rewards.sum())
                recent_episodes += int(frame.dones.sum())

            with torch.inference_mode():
                next_value = model(
                    torch.from_numpy(frame.obs).to(device),
                    torch.from_numpy(frame.masks).to(device),
                )[1].cpu().numpy()
            advantages = np.zeros_like(rew_buf)
            last = np.zeros(n, dtype=np.float32)
            for step in reversed(range(t)):
                alive = 1.0 - done_buf[step].astype(np.float32)
                nv = next_value if step == t - 1 else val_buf[step + 1]
                delta = rew_buf[step] + args.gamma * nv * alive - val_buf[step]
                last = delta + args.gamma * args.gae_lambda * alive * last
                advantages[step] = last
            returns = advantages + val_buf

            flat = t * n
            obs_flat = obs_buf.reshape(flat, d)
            mask_flat = mask_buf.reshape(flat, a)
            act_flat = act_buf.reshape(flat)
            old_logp = logp_buf.reshape(flat)
            adv_flat = advantages.reshape(flat)
            ret_flat = returns.reshape(flat)
            adv_flat = (adv_flat - adv_flat.mean()) / (adv_flat.std() + 1e-8)
            indices = np.arange(flat)
            model.train()
            losses = []
            for _epoch in range(args.epochs):
                np.random.shuffle(indices)
                for start in range(0, flat, args.minibatch):
                    ix = indices[start:start + args.minibatch]
                    o = torch.from_numpy(obs_flat[ix].astype(np.float32)).to(device)
                    m = torch.from_numpy(mask_flat[ix]).to(device)
                    actions = torch.from_numpy(act_flat[ix].astype(np.int64)).to(device)
                    oldlp = torch.from_numpy(old_logp[ix]).to(device)
                    adv = torch.from_numpy(adv_flat[ix]).to(device)
                    ret = torch.from_numpy(ret_flat[ix]).to(device)
                    dist, value = model.distribution(o, m)
                    logp = dist.log_prob(actions)
                    ratio = (logp - oldlp).exp()
                    policy_loss = -torch.min(ratio * adv, ratio.clamp(1 - args.clip, 1 + args.clip) * adv).mean()
                    value_loss = 0.5 * (value - ret).pow(2).mean()
                    entropy = dist.entropy().mean()
                    loss = policy_loss + value_loss * 0.5 - args.entropy * entropy
                    optimizer.zero_grad(set_to_none=True)
                    loss.backward()
                    torch.nn.utils.clip_grad_norm_(model.parameters(), 0.5)
                    optimizer.step()
                    losses.append((float(policy_loss.detach()), float(value_loss.detach()), float(entropy.detach())))

            total_steps += flat
            elapsed = time.monotonic() - started
            mean_loss = np.mean(losses, axis=0) if losses else [0, 0, 0]
            progress = {
                "update": update,
                "steps": total_steps,
                "stepsPerSec": round(total_steps / max(1, elapsed)),
                "episodes": recent_episodes,
                "meanEpisodeRewardWindow": round(recent_reward / max(1, recent_episodes), 4),
                "policyLoss": round(float(mean_loss[0]), 5),
                "valueLoss": round(float(mean_loss[1]), 5),
                "entropy": round(float(mean_loss[2]), 5),
                "minutesLeft": round(max(0, deadline - time.monotonic()) / 60, 1),
            }
            print(json.dumps(progress), flush=True)
            with (output / "progress.jsonl").open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(progress) + "\n")
            recent_reward = 0
            recent_episodes = 0
            if update % args.save_every == 0:
                checkpoint(output / f"checkpoint-{update:05d}.pt", model, optimizer, args, update, total_steps, pool.processes[0].meta)
        checkpoint(output / "final.pt", model, optimizer, args, update, total_steps, pool.processes[0].meta)
    finally:
        pool.close()


if __name__ == "__main__":
    main()
