from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path

import numpy as np
import torch

from model import EntityActorCritic
from protocol import VectorPool


def parser() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Evaluate one policy on an exact paired seed set")
    p.add_argument("--checkpoint", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--config", default=None)
    p.add_argument("--episodes", type=int, default=512)
    p.add_argument("--envs", type=int, default=128)
    p.add_argument("--sim-workers", type=int, default=4)
    p.add_argument("--character", default="all", choices=["all", "runner", "vector", "ghost", "array"])
    p.add_argument("--ascension", type=int, default=0)
    p.add_argument("--seed-base", type=int, default=70_000_027)
    p.add_argument("--device", default="cuda")
    p.add_argument("--sample", action="store_true", help="sample instead of deterministic argmax")
    return p.parse_args()


def read_episodes(directory: Path) -> list[dict]:
    rows: list[dict] = []
    for path in sorted((directory / "episodes").glob("*.jsonl")):
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rows.append(json.loads(line))
    return sorted(rows, key=lambda r: (r["seed"], r["character"]))


def write_summary(directory: Path, rows: list[dict], checkpoint: str, config: str | None) -> dict:
    groups: dict[str, list[dict]] = {c: [] for c in ("runner", "vector", "ghost", "array")}
    for row in rows:
        groups[row["character"]].append(row)
    summary_rows = []
    for char, values in groups.items():
        if not values:
            continue
        floors = np.asarray([r["floor"] for r in values], dtype=np.float64)
        wins = np.asarray([r["win"] for r in values], dtype=np.float64)
        summary_rows.append({
            "character": char,
            "episodes": len(values),
            "wins": int(wins.sum()),
            "winRate": round(float(wins.mean() * 100), 3),
            "floorMean": round(float(floors.mean()), 3),
            "floorP25": round(float(np.percentile(floors, 25)), 3),
            "floorMedian": round(float(np.percentile(floors, 50)), 3),
            "floorP75": round(float(np.percentile(floors, 75)), 3),
            "floorP90": round(float(np.percentile(floors, 90)), 3),
            "deepWins": sum(bool(r["deep"]) for r in values),
            "meanHpLost": round(float(np.mean([r["behavior"]["hpLost"] for r in values])), 3),
            "meanTurns": round(float(np.mean([r["behavior"]["turns"] for r in values])), 3),
        })
    summary = {
        "schema": 1,
        "checkpoint": str(Path(checkpoint).resolve()),
        "configPath": str(Path(config).resolve()) if config else None,
        "episodes": len(rows),
        "rows": summary_rows,
    }
    (directory / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    with (directory / "summary.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(summary_rows[0].keys()) if summary_rows else ["character"])
        writer.writeheader(); writer.writerows(summary_rows)
    with (directory / "episodes.csv").open("w", newline="", encoding="utf-8") as fh:
        fields = ["config", "style", "seed", "character", "ascension", "win", "deep", "act", "floor", "hp", "maxHp", "gold", "steps", "reward", "deckSize", "relics"]
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for r in rows:
            writer.writerow({**{k: r[k] for k in fields if k in r}, "deckSize": len(r["deck"]), "relics": len(r["relics"])})
    return summary


def main() -> None:
    args = parser()
    output = Path(args.output)
    episode_dir = output / "episodes"
    episode_dir.mkdir(parents=True, exist_ok=True)
    existing = list(episode_dir.glob("episodes-worker-*.jsonl"))
    if existing:
        raise SystemExit(f"refusing to append to existing evaluation logs: {existing[0]}")
    payload = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    meta = payload["meta"]
    device = torch.device(args.device if torch.cuda.is_available() else "cpu")
    model = EntityActorCritic(
        int(meta["globalDim"]), int(meta["actionDim"]), int(meta["actionFeatDim"])
    ).to(device)
    model.load_state_dict(payload["model"])
    model.eval()
    style = int(payload.get("args", {}).get("style", 0))
    pool = VectorPool(
        min(args.envs, args.episodes), args.sim_workers,
        character=args.character, ascension=args.ascension, seed_base=args.seed_base,
        style=style, config=args.config, log_dir=str(episode_dir), max_episodes=args.episodes,
    )
    completed = 0
    started = time.monotonic()
    frame = pool.frame
    try:
        while completed < args.episodes:
            with torch.inference_mode():
                dist, _ = model.distribution(
                    torch.from_numpy(frame.obs).to(device),
                    torch.from_numpy(frame.masks).to(device),
                )
                actions = (dist.sample() if args.sample else dist.logits.argmax(dim=-1)).cpu().numpy().astype(np.int16)
            frame = pool.step(actions)
            completed += int(frame.dones.sum())
            if completed and completed % 100 == 0:
                print(json.dumps({"completed": completed, "episodesPerSec": round(completed / (time.monotonic() - started), 2)}), flush=True)
    finally:
        pool.close()
    rows = read_episodes(output)
    if len(rows) != args.episodes:
        raise RuntimeError(f"expected {args.episodes} episode rows, found {len(rows)}")
    summary = write_summary(output, rows, args.checkpoint, args.config)
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
