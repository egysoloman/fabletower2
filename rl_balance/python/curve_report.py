from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path


CHARACTERS = ("runner", "vector", "ghost", "array")


def main() -> None:
    parser = argparse.ArgumentParser(description="Aggregate A1-A20 balance runs into one difficulty-curve export")
    parser.add_argument("--root", required=True, help="directory containing a1/, a2/, ... run roots")
    parser.add_argument("--output", default=None, help="output directory (defaults to ROOT/curve-report)")
    args = parser.parse_args()

    root = Path(args.root)
    output = Path(args.output) if args.output else root / "curve-report"
    output.mkdir(parents=True, exist_ok=True)
    details: list[dict] = []

    ascension_dirs = sorted(
        (path for path in root.glob("a*") if path.is_dir() and path.name[1:].isdigit()),
        key=lambda path: int(path.name[1:]),
    )
    for run in ascension_dirs:
        ascension = int(run.name[1:])
        simulation = run / "simulation"
        overview = json.loads((simulation / "overview.json").read_text(encoding="utf-8"))
        baseline = {row["character"]: row for row in overview["characters"]}
        changes = json.loads((simulation / "paired_population.json").read_text(encoding="utf-8"))

        for character in CHARACTERS:
            base = baseline[character]
            details.append({
                "ascension": ascension,
                "config": "baseline",
                "character": character,
                "episodes": base["episodes"],
                "pairedPolicySeeds": base["episodes"],
                "winRate": base["winRate"],
                "floorMean": base["floorMean"],
                "winRateDeltaPoints": 0.0,
                "winRateDeltaCi95Low": 0.0,
                "winRateDeltaCi95High": 0.0,
                "floorDeltaMean": 0.0,
                "floorDeltaCi95Low": 0.0,
                "floorDeltaCi95High": 0.0,
            })
        for change in changes:
            base = baseline[change["character"]]
            details.append({
                "ascension": ascension,
                "config": change["config"],
                "character": change["character"],
                "episodes": base["episodes"],
                "pairedPolicySeeds": change["pairedPolicySeeds"],
                "winRate": round(base["winRate"] + change["winRateDeltaPoints"], 4),
                "floorMean": round(base["floorMean"] + change["floorDeltaMean"], 4),
                "winRateDeltaPoints": change["winRateDeltaPoints"],
                "winRateDeltaCi95Low": change.get("winRateDeltaCi95Low"),
                "winRateDeltaCi95High": change.get("winRateDeltaCi95High"),
                "floorDeltaMean": change["floorDeltaMean"],
                "floorDeltaCi95Low": change.get("floorDeltaCi95Low"),
                "floorDeltaCi95High": change.get("floorDeltaCi95High"),
            })

    grouped: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for row in details:
        grouped[(row["ascension"], row["config"])].append(row)
    summaries = []
    previous: dict[str, dict] = {}
    for (ascension, config), rows in sorted(grouped.items()):
        wins = [row["winRate"] for row in rows]
        floors = [row["floorMean"] for row in rows]
        summary = {
            "ascension": ascension,
            "config": config,
            "episodes": sum(row["episodes"] for row in rows),
            "winRateMean": round(sum(wins) / len(wins), 4),
            "winRateMin": round(min(wins), 4),
            "winRateMax": round(max(wins), 4),
            "winRateSpread": round(max(wins) - min(wins), 4),
            "floorMean": round(sum(floors) / len(floors), 4),
            "floorMin": round(min(floors), 4),
            "floorMax": round(max(floors), 4),
            "floorSpread": round(max(floors) - min(floors), 4),
        }
        prior = previous.get(config)
        summary["winRateChangeFromPreviousAsc"] = round(summary["winRateMean"] - prior["winRateMean"], 4) if prior else None
        summary["floorChangeFromPreviousAsc"] = round(summary["floorMean"] - prior["floorMean"], 4) if prior else None
        previous[config] = summary
        summaries.append(summary)

    payload = {"schema": 1, "root": str(root.resolve()), "details": details, "summaries": summaries}
    (output / "curve.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    for filename, rows in (("curve.csv", details), ("curve-summary.csv", summaries)):
        with (output / filename).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]) if rows else ["ascension"])
            writer.writeheader()
            writer.writerows(rows)

    lines = [
        "# A1-A10 难度曲线报告", "",
        "| A | 配置 | 平均胜率 | 最低–最高 | 胜率差 | 平均层数 | 最低–最高 | 层数差 |",
        "|---:|---|---:|---:|---:|---:|---:|---:|",
    ]
    for row in summaries:
        lines.append(
            f"| {row['ascension']} | {row['config']} | {row['winRateMean']:.2f}% | "
            f"{row['winRateMin']:.2f}–{row['winRateMax']:.2f}% | {row['winRateSpread']:.2f} | "
            f"{row['floorMean']:.2f} | {row['floorMin']:.2f}–{row['floorMax']:.2f} | {row['floorSpread']:.2f} |"
        )
    (output / "curve.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"ascensions": len(ascension_dirs), "details": len(details), "output": str(output)}))


if __name__ == "__main__":
    main()
