from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


HERE = Path(__file__).resolve().parent


def main() -> None:
    p = argparse.ArgumentParser(description="Evaluate policy population against balance candidates")
    p.add_argument("--checkpoints", required=True, help="directory containing style-*/final.pt")
    p.add_argument("--configs", required=True, help="JSON array of candidate config objects")
    p.add_argument("--output", required=True)
    p.add_argument("--episodes", type=int, default=512)
    p.add_argument("--gpus", type=int, default=8)
    p.add_argument("--envs", type=int, default=128)
    p.add_argument("--sim-workers", type=int, default=4)
    p.add_argument("--ascension", type=int, default=0)
    p.add_argument("--skip-config", action="append", default=[], help="config name to omit (may be repeated); useful when reusing a hard-linked baseline")
    args = p.parse_args()
    checkpoint_root = Path(args.checkpoints)
    output = Path(args.output)
    config_dir = output / "resolved_configs"
    config_dir.mkdir(parents=True, exist_ok=True)
    configs = json.loads(Path(args.configs).read_text(encoding="utf-8"))
    config_paths = []
    for config in configs:
        path = config_dir / f'{config["name"]}.json'
        path.write_text(json.dumps(config, indent=2), encoding="utf-8")
        if config["name"] not in args.skip_config:
            config_paths.append(path)
    checkpoints = sorted(checkpoint_root.glob("style-*/final.pt"))
    if not checkpoints:
        raise SystemExit(f"no style-*/final.pt under {checkpoint_root}")
    jobs = [(ckpt, config) for config in config_paths for ckpt in checkpoints]

    # A parent process may expose only a physical GPU subset (for example
    # CUDA_VISIBLE_DEVICES=4,5,6,7). Preserve that mapping instead of resetting
    # every child to physical devices 0..N, which would make concurrent sweeps
    # collide on the first GPU group and leave the second group idle.
    visible = [item.strip() for item in os.environ.get("CUDA_VISIBLE_DEVICES", "").split(",") if item.strip()]
    gpu_ids = visible if visible else [str(gpu) for gpu in range(args.gpus)]
    if args.gpus > len(gpu_ids):
        raise SystemExit(f"requested {args.gpus} GPUs but only {len(gpu_ids)} are visible")

    job_lock = threading.Lock()
    pending = list(jobs)

    def run(gpu: int, ckpt: Path, config: Path):
        style = ckpt.parent.name
        target = output / config.stem / style
        env = os.environ.copy()
        env["CUDA_VISIBLE_DEVICES"] = gpu_ids[gpu]
        cmd = [
            sys.executable, str(HERE / "evaluate.py"), "--checkpoint", str(ckpt),
            "--config", str(config), "--output", str(target), "--episodes", str(args.episodes),
            "--envs", str(args.envs), "--sim-workers", str(args.sim_workers),
            "--ascension", str(args.ascension), "--device", "cuda",
        ]
        log = target / "evaluate.log"
        target.mkdir(parents=True, exist_ok=True)
        with log.open("w", encoding="utf-8") as fh:
            code = subprocess.call(cmd, env=env, stdout=fh, stderr=subprocess.STDOUT)
        return target, code

    # One persistent queue consumer per GPU guarantees no accidental sharing.
    failed: list[str] = []
    def gpu_worker(gpu: int):
        local_failed = []
        while True:
            with job_lock:
                if not pending:
                    break
                job = pending.pop(0)
            target, code = run(gpu, *job)
            print(json.dumps({"gpu": gpu, "target": str(target), "exit": code}), flush=True)
            if code:
                local_failed.append(str(target))
        return local_failed

    with ThreadPoolExecutor(max_workers=args.gpus) as executor:
        for result in executor.map(gpu_worker, range(args.gpus)):
            failed.extend(result)
    if failed:
        raise SystemExit(f"evaluation failures: {failed}")
    subprocess.check_call([sys.executable, str(HERE / "compare.py"), "--root", str(output)])
    baseline_dir = output / "baseline"
    subprocess.check_call([sys.executable, str(HERE / "discover.py"), str(baseline_dir if baseline_dir.exists() else output), "--output", str(output / "discovered")])
    subprocess.check_call([sys.executable, str(HERE / "report.py"), "--run", str(output.parent)])


if __name__ == "__main__":
    main()
