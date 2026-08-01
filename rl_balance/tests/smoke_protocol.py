#!/usr/bin/env python3
"""No numpy/torch required: validates the binary engine protocol and full-run reset."""
from __future__ import annotations

import json
import struct
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TSX = ROOT / "node_modules" / ".bin" / "tsx"
SERVER = ROOT / "rl_balance" / "ts" / "env_server.ts"


def read_exact(stream, size: int) -> bytes:
    result = b""
    while len(result) < size:
        chunk = stream.read(size - len(result))
        if not chunk:
            raise AssertionError("simulator closed mid-frame")
        result += chunk
    return result


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="neonspire-rl-smoke-") as tmp:
        log = Path(tmp) / "episodes.jsonl"
        proc = subprocess.Popen(
            [str(TSX), str(SERVER), "--envs", "2", "--max-episodes", "4", "--episode-log", str(log), "--max-steps", "1000"],
            cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        assert proc.stdin and proc.stdout and proc.stderr
        meta = json.loads(proc.stderr.readline())
        assert meta["ready"] and meta["envs"] == 2
        envs, obs_dim, action_dim = meta["envs"], meta["obsDim"], meta["actionDim"]

        def frame():
            obs = read_exact(proc.stdout, envs * obs_dim * 4)
            masks = read_exact(proc.stdout, envs * action_dim)
            rewards = read_exact(proc.stdout, envs * 4)
            dones = read_exact(proc.stdout, envs)
            assert len(obs) == envs * obs_dim * 4
            assert all(any(masks[i * action_dim:(i + 1) * action_dim]) for i in range(envs))
            return masks, rewards, dones

        masks, _, _ = frame()
        completed = 0
        steps = 0
        while completed < 4 and steps < 2000:
            # First legal action is deterministic and intentionally weak; it still
            # traverses every phase and reaches terminal states quickly.
            actions = []
            for i in range(envs):
                legal = masks[i * action_dim:(i + 1) * action_dim]
                actions.append(next(j for j, value in enumerate(legal) if value))
            proc.stdin.write(struct.pack("<" + "h" * envs, *actions)); proc.stdin.flush()
            masks, _, dones = frame()
            completed += sum(dones)
            steps += 1
        proc.terminate(); proc.wait(timeout=5)
        assert completed == 4, (completed, steps)
        rows = [json.loads(line) for line in log.read_text().splitlines() if line]
        assert len(rows) == 4
        assert {r["character"] for r in rows} == {"runner", "vector", "ghost", "array"}
        assert all(r["steps"] > 0 and r["deck"] and "behavior" in r for r in rows)
        print(json.dumps({"ok": True, "episodes": len(rows), "steps": steps, "meta": meta}))


if __name__ == "__main__":
    main()
