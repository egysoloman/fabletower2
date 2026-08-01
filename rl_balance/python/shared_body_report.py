from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np


CHARS = ("runner", "vector", "ghost", "array")
DEFAULT_CANDIDATE = "every_switch_shared4"


def load_episodes(directory: Path) -> list[dict]:
    rows: list[dict] = []
    for path in directory.rglob("episodes-worker-*.jsonl"):
        rows.extend(json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip())
    return rows


def candidate_metrics(rows: list[dict], char: str) -> dict:
    local = [row for row in rows if row["character"] == char]
    floors = np.asarray([row["floor"] for row in local], dtype=float)
    return {
        "episodes": len(local),
        "winRate": round(100 * sum(bool(row["win"]) for row in local) / len(local), 3),
        "floorMean": round(float(floors.mean()), 3),
        "floorP25": round(float(np.percentile(floors, 25)), 3),
        "floorMedian": round(float(np.percentile(floors, 50)), 3),
        "floorP75": round(float(np.percentile(floors, 75)), 3),
        "reachFloor8Rate": round(100 * float(np.mean(floors >= 8)), 3),
        "reachFloor16Rate": round(100 * float(np.mean(floors >= 16)), 3),
    }


def parse_run(value: str) -> tuple[str, Path]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("run must be LABEL=PATH")
    label, path = value.split("=", 1)
    if not label or not path:
        raise argparse.ArgumentTypeError("run must be LABEL=PATH")
    return label, Path(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize shared-body ARRAY candidate across policy populations")
    parser.add_argument("--run", action="append", type=parse_run, required=True, help="LABEL=simulation-directory")
    parser.add_argument("--candidate", default=DEFAULT_CANDIDATE)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    candidate = args.candidate

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []
    for label, run in args.run:
        paired = json.loads((run / "paired_population.json").read_text(encoding="utf-8"))
        paired_by_char = {
            row["character"]: row for row in paired if row["config"] == candidate
        }
        episodes = load_episodes(run / candidate)
        for char in CHARS:
            if char not in paired_by_char:
                continue
            records.append({
                "population": label,
                "character": char,
                **candidate_metrics(episodes, char),
                **{key: value for key, value in paired_by_char[char].items() if key not in {"config", "character"}},
            })

    report = {
        "schema": 1,
        "candidate": candidate,
        "warning": "Populations are independently trained; compare candidate-vs-baseline paired deltas within a population before cross-population raw rates.",
        "records": records,
    }
    (output / "shared-body-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    with (output / "shared-body-report.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)

    lines = [
        "# ARRAY 共用血条候选报告", "",
        "> 不同策略组之间不是配对因果比较；优先看每组内部相对正式规则的配对变化。", "",
        "| 策略组 | 角色 | 胜率 | 均层 | 到达 8 层 | 到达 16 层 | 胜率变化 | 均层变化 |", "|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    for row in records:
        lines.append(
            f"| {row['population']} | {row['character']} | {row['winRate']}% | {row['floorMean']} | "
            f"{row['reachFloor8Rate']}% | {row['reachFloor16Rate']}% | {row['winRateDeltaPoints']:+.3f}pp | "
            f"{row['floorDeltaMean']:+.3f} |"
        )
    (output / "shared-body-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(output / "shared-body-report.json"), "records": len(records)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
