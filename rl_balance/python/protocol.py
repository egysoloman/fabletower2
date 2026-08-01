from __future__ import annotations

import json
import os
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "rl_balance" / "ts" / "env_server.ts"
TSX = ROOT / "node_modules" / ".bin" / "tsx"


def _read_exact(stream, size: int) -> bytes:
    chunks: list[bytes] = []
    remaining = size
    while remaining:
        chunk = stream.read(remaining)
        if not chunk:
            raise EOFError(f"simulator closed with {remaining} bytes left in frame")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


@dataclass(frozen=True)
class Frame:
    obs: np.ndarray
    masks: np.ndarray
    rewards: np.ndarray
    dones: np.ndarray


class EngineProcess:
    """One long-lived Node process hosting a fixed batch of exact engine envs."""

    def __init__(
        self,
        envs: int,
        *,
        character: str = "all",
        ascension: int = 0,
        seed_base: int = 1_000_003,
        style: int = 0,
        config: str | None = None,
        episode_log: str | None = None,
        max_episodes: int = 0,
        max_steps: int = 6000,
    ) -> None:
        cmd = [
            str(TSX), str(SERVER), "--envs", str(envs), "--character", character,
            "--ascension", str(ascension), "--seed-base", str(seed_base),
            "--style", str(style), "--max-episodes", str(max_episodes),
            "--max-steps", str(max_steps),
        ]
        if config:
            cmd += ["--config", str(config)]
        if episode_log:
            Path(episode_log).parent.mkdir(parents=True, exist_ok=True)
            cmd += ["--episode-log", str(episode_log)]
        self.proc = subprocess.Popen(
            cmd,
            cwd=ROOT,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
        )
        assert self.proc.stdin and self.proc.stdout and self.proc.stderr
        ready = self.proc.stderr.readline()
        if not ready:
            raise RuntimeError("simulator exited before handshake")
        try:
            self.meta = json.loads(ready)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"bad simulator handshake: {ready!r}") from exc
        self.envs = int(self.meta["envs"])
        self.obs_dim = int(self.meta["obsDim"])
        self.action_dim = int(self.meta["actionDim"])
        self._stderr_lines: list[str] = []
        self._stderr_thread = threading.Thread(target=self._drain_stderr, daemon=True)
        self._stderr_thread.start()
        self.frame = self._read_frame()

    def _drain_stderr(self) -> None:
        assert self.proc.stderr
        for raw in self.proc.stderr:
            self._stderr_lines.append(raw.decode("utf-8", errors="replace").rstrip())
            del self._stderr_lines[:-20]

    def _read_frame(self) -> Frame:
        assert self.proc.stdout
        obs = np.frombuffer(
            _read_exact(self.proc.stdout, self.envs * self.obs_dim * 4), dtype="<f4"
        ).reshape(self.envs, self.obs_dim).copy()
        masks = np.frombuffer(
            _read_exact(self.proc.stdout, self.envs * self.action_dim), dtype=np.uint8
        ).reshape(self.envs, self.action_dim).astype(np.bool_)
        rewards = np.frombuffer(
            _read_exact(self.proc.stdout, self.envs * 4), dtype="<f4"
        ).copy()
        dones = np.frombuffer(
            _read_exact(self.proc.stdout, self.envs), dtype=np.uint8
        ).astype(np.bool_)
        return Frame(obs=obs, masks=masks, rewards=rewards, dones=dones)

    def step(self, actions: np.ndarray) -> Frame:
        if actions.shape != (self.envs,):
            raise ValueError(f"actions must have shape {(self.envs,)}, got {actions.shape}")
        assert self.proc.stdin
        self.proc.stdin.write(np.asarray(actions, dtype="<i2").tobytes())
        self.proc.stdin.flush()
        self.frame = self._read_frame()
        return self.frame

    def close(self) -> None:
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait(timeout=3)


class VectorPool:
    """Several Node shards stepped concurrently, exposed as one vector env."""

    def __init__(
        self,
        total_envs: int,
        workers: int,
        *,
        character: str = "all",
        ascension: int = 0,
        seed_base: int = 1_000_003,
        style: int = 0,
        config: str | None = None,
        log_dir: str | None = None,
        max_episodes: int = 0,
        max_steps: int = 6000,
    ) -> None:
        workers = max(1, min(workers, total_envs))
        counts = [total_envs // workers + (i < total_envs % workers) for i in range(workers)]
        self.processes: list[EngineProcess] = []
        episode_offset = 0
        for index, count in enumerate(counts):
            # Evaluation gives each shard a disjoint contiguous episode range.
            shard_max = 0
            if max_episodes:
                shard_max = max_episodes // workers + (index < max_episodes % workers)
            log = str(Path(log_dir) / f"episodes-worker-{index}.jsonl") if log_dir else None
            proc = EngineProcess(
                count,
                character=character,
                ascension=ascension,
                seed_base=seed_base + episode_offset * 7919,
                style=style,
                config=config,
                episode_log=log,
                max_episodes=shard_max,
                max_steps=max_steps,
            )
            self.processes.append(proc)
            episode_offset += shard_max
        first = self.processes[0]
        if any(p.obs_dim != first.obs_dim or p.action_dim != first.action_dim for p in self.processes):
            raise RuntimeError("simulator shards disagree about dimensions")
        self.obs_dim = first.obs_dim
        self.action_dim = first.action_dim
        self.global_dim = int(first.meta["globalDim"])
        self.action_feat_dim = int(first.meta["actionFeatDim"])
        self.total_envs = sum(p.envs for p in self.processes)
        self._executor = ThreadPoolExecutor(max_workers=len(self.processes))
        self.frame = self._join([p.frame for p in self.processes])

    @staticmethod
    def _join(frames: Sequence[Frame]) -> Frame:
        return Frame(
            obs=np.concatenate([f.obs for f in frames]),
            masks=np.concatenate([f.masks for f in frames]),
            rewards=np.concatenate([f.rewards for f in frames]),
            dones=np.concatenate([f.dones for f in frames]),
        )

    def step(self, actions: np.ndarray) -> Frame:
        chunks: list[np.ndarray] = []
        offset = 0
        for proc in self.processes:
            chunks.append(actions[offset:offset + proc.envs])
            offset += proc.envs
        frames = list(self._executor.map(lambda pair: pair[0].step(pair[1]), zip(self.processes, chunks)))
        self.frame = self._join(frames)
        return self.frame

    def close(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
        for proc in self.processes:
            proc.close()

    def __enter__(self) -> "VectorPool":
        return self

    def __exit__(self, *_args) -> None:
        self.close()


def set_worker_threads(count: int) -> None:
    # Avoid every independent GPU job starting a full BLAS thread pool.
    os.environ.setdefault("OMP_NUM_THREADS", str(max(1, count)))
    os.environ.setdefault("MKL_NUM_THREADS", str(max(1, count)))
