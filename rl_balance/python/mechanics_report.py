from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np


CHARS = ("runner", "vector", "ghost", "array")


def load_episodes(directory: Path) -> list[dict]:
    rows: list[dict] = []
    for path in directory.rglob("episodes-worker-*.jsonl"):
        rows.extend(json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip())
    return rows


def metrics(rows: list[dict]) -> list[dict]:
    output = []
    for char in CHARS:
        local = [row for row in rows if row["character"] == char]
        if not local:
            continue
        floors = np.asarray([row["floor"] for row in local], dtype=float)
        output.append({
            "character": char,
            "episodes": len(local),
            "winRate": round(100 * sum(bool(row["win"]) for row in local) / len(local), 3),
            "floorMean": round(float(floors.mean()), 3),
            "floorP25": round(float(np.percentile(floors, 25)), 3),
            "floorMedian": round(float(np.percentile(floors, 50)), 3),
            "floorP75": round(float(np.percentile(floors, 75)), 3),
            "reachFloor8Rate": round(100 * float(np.mean(floors >= 8)), 3),
            "reachFloor16Rate": round(100 * float(np.mean(floors >= 16)), 3),
            "meanTurns": round(float(np.mean([row["behavior"]["turns"] for row in local])), 3),
            "meanHpLost": round(float(np.mean([row["behavior"]["hpLost"] for row in local])), 3),
        })
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare zero-shot and mechanism-adapted policy populations")
    parser.add_argument("--zero-shot", required=True, help="zero-shot simulation directory")
    parser.add_argument("--synergy-run", required=True, help="synergy-trained simulation directory")
    parser.add_argument("--linear-run", required=True, help="linear-trained simulation directory")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    zero = Path(args.zero_shot)
    synergy = Path(args.synergy_run)
    linear = Path(args.linear_run)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    zero_population = json.loads((zero / "paired_population.json").read_text(encoding="utf-8"))
    synergy_population = json.loads((synergy / "paired_population.json").read_text(encoding="utf-8"))
    linear_population = json.loads((linear / "paired_population.json").read_text(encoding="utf-8"))
    synergy_metrics = metrics(load_episodes(synergy / "every_switch_synergy"))
    linear_metrics = metrics(load_episodes(linear / "every_switch_linear"))
    synergy_by_char = {row["character"]: row for row in synergy_metrics}
    linear_by_char = {row["character"]: row for row in linear_metrics}
    comparison = []
    for char in CHARS:
        if char not in synergy_by_char or char not in linear_by_char:
            continue
        s = synergy_by_char[char]
        l = linear_by_char[char]
        comparison.append({
            "character": char,
            "synergyMinusLinearFloor": round(s["floorMean"] - l["floorMean"], 3),
            "synergyMinusLinearWinPoints": round(s["winRate"] - l["winRate"], 3),
        })

    report = {
        "schema": 1,
        "warning": "Cross-trained comparison is descriptive, not paired: the policy populations adapted under different rules.",
        "zeroShotPairedChanges": zero_population,
        "adaptedPairedChanges": {
            "synergyPopulation": [row for row in synergy_population if row["config"] == "every_switch_synergy"],
            "linearPopulation": [row for row in linear_population if row["config"] == "every_switch_linear"],
        },
        "adapted": {"synergy": synergy_metrics, "linear": linear_metrics},
        "adaptedComparison": comparison,
    }
    (output / "mechanics-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    with (output / "mechanics-adapted.csv").open("w", newline="", encoding="utf-8") as handle:
        fields = ["candidate", *synergy_metrics[0].keys()]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows([{"candidate": "synergy", **row} for row in synergy_metrics])
        writer.writerows([{"candidate": "linear", **row} for row in linear_metrics])

    lines = [
        "# 机制候选适应训练报告", "",
        "> 两套策略在不同规则下适应训练，横向差值是描述性指标，不是同策略配对因果量。", "",
        "| 角色 | 协同胜率 | 线性胜率 | 协同均层 | 线性均层 | 协同-线性均层 |", "|---|---:|---:|---:|---:|---:|",
    ]
    for row in comparison:
        char = row["character"]
        s, l = synergy_by_char[char], linear_by_char[char]
        lines.append(f"| {char} | {s['winRate']}% | {l['winRate']}% | {s['floorMean']} | {l['floorMean']} | {row['synergyMinusLinearFloor']:+.3f} |")
    lines.extend([
        "", "## 适应后相对正式规则的配对变化", "",
        "| 策略组 | 角色 | 胜率变化 | 均层变化 | 95% CI（均层） |", "|---|---|---:|---:|---:|",
    ])
    for population, rows in (
        ("协同", report["adaptedPairedChanges"]["synergyPopulation"]),
        ("线性", report["adaptedPairedChanges"]["linearPopulation"]),
    ):
        for row in rows:
            lines.append(
                f"| {population} | {row['character']} | {row['winRateDeltaPoints']:+.3f}pp | "
                f"{row['floorDeltaMean']:+.3f} | [{row['floorDeltaCi95Low']:+.3f}, {row['floorDeltaCi95High']:+.3f}] |"
            )
    (output / "mechanics-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(output / "mechanics-report.json"), "comparison": comparison}, ensure_ascii=False))


if __name__ == "__main__":
    main()
