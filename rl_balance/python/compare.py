from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

import numpy as np


def load(directory: Path) -> list[dict]:
    rows = []
    for path in directory.rglob("episodes-worker-*.jsonl"):
        rows.extend(json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip())
    return rows


def main() -> None:
    p = argparse.ArgumentParser(description="Paired-seed comparison of balance simulation exports")
    p.add_argument("--root", required=True)
    p.add_argument("--baseline", default="baseline")
    args = p.parse_args()
    root = Path(args.root)
    grouped: dict[tuple[str, int, str], list[dict]] = defaultdict(list)
    for row in load(root):
        grouped[(row["config"], int(row.get("style", 0)), row["character"])].append(row)
    output = []
    for (config, style, char), rows in sorted(grouped.items()):
        if config == args.baseline:
            continue
        base = {r["seed"]: r for r in grouped.get((args.baseline, style, char), [])}
        pairs = [(base[r["seed"]], r) for r in rows if r["seed"] in base]
        if not pairs:
            continue
        floor_delta = np.asarray([b[1]["floor"] - b[0]["floor"] for b in pairs], dtype=float)
        win_delta = np.asarray([int(b[1]["win"]) - int(b[0]["win"]) for b in pairs], dtype=float)
        rng = np.random.default_rng(20260731)
        boot = np.asarray([rng.choice(floor_delta, len(floor_delta), replace=True).mean() for _ in range(2000)])
        output.append({
            "config": config, "style": style, "character": char, "pairedSeeds": len(pairs),
            "floorDeltaMean": round(float(floor_delta.mean()), 4),
            "floorDeltaCi95Low": round(float(np.percentile(boot, 2.5)), 4),
            "floorDeltaCi95High": round(float(np.percentile(boot, 97.5)), 4),
            "winRateDeltaPoints": round(float(win_delta.mean() * 100), 4),
        })
    (root / "paired_comparison.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
    with (root / "paired_comparison.csv").open("w", newline="", encoding="utf-8") as fh:
        fields = list(output[0]) if output else ["config"]
        writer = csv.DictWriter(fh, fieldnames=fields); writer.writeheader(); writer.writerows(output)
    # A policy-population aggregate keeps every (style, seed) pair paired.  Do
    # not average the already-rounded per-style rows: retaining the raw deltas
    # also lets the exported population result carry its own confidence bounds.
    aggregate = []
    for config in sorted({row["config"] for row in output}):
        for char in ("runner", "vector", "ghost", "array"):
            floor_values: list[float] = []
            win_values: list[float] = []
            for (local_config, style, local_char), rows in grouped.items():
                if local_config != config or local_char != char:
                    continue
                base = {r["seed"]: r for r in grouped.get((args.baseline, style, char), [])}
                for row in rows:
                    if row["seed"] not in base:
                        continue
                    floor_values.append(float(row["floor"] - base[row["seed"]]["floor"]))
                    win_values.append(float(int(row["win"]) - int(base[row["seed"]]["win"])))
            if floor_values:
                floor_delta = np.asarray(floor_values, dtype=float)
                win_delta = np.asarray(win_values, dtype=float)
                rng = np.random.default_rng(20260731)
                floor_boot = np.asarray([rng.choice(floor_delta, len(floor_delta), replace=True).mean() for _ in range(2000)])
                win_boot = np.asarray([rng.choice(win_delta, len(win_delta), replace=True).mean() * 100 for _ in range(2000)])
                aggregate.append({
                    "config": config, "character": char, "pairedPolicySeeds": len(floor_delta),
                    "floorDeltaMean": round(float(floor_delta.mean()), 4),
                    "floorDeltaCi95Low": round(float(np.percentile(floor_boot, 2.5)), 4),
                    "floorDeltaCi95High": round(float(np.percentile(floor_boot, 97.5)), 4),
                    "winRateDeltaPoints": round(float(win_delta.mean() * 100), 4),
                    "winRateDeltaCi95Low": round(float(np.percentile(win_boot, 2.5)), 4),
                    "winRateDeltaCi95High": round(float(np.percentile(win_boot, 97.5)), 4),
                })
    (root / "paired_population.json").write_text(json.dumps(aggregate, indent=2), encoding="utf-8")
    print(json.dumps({"perStyle": output, "population": aggregate}, ensure_ascii=False))


if __name__ == "__main__":
    main()
