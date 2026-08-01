from __future__ import annotations

import csv
import json
from pathlib import Path
import argparse

import numpy as np


def rows_under(path: Path) -> list[dict]:
    rows = []
    for file in path.rglob("episodes-worker-*.jsonl"):
        rows.extend(json.loads(line) for line in file.read_text(encoding="utf-8").splitlines() if line.strip())
    return rows


def main() -> None:
    p = argparse.ArgumentParser(description="Build a compact human/machine-readable RL balance overview")
    p.add_argument("--run", required=True)
    args = p.parse_args()
    run = Path(args.run)
    simulation = run / "simulation"
    episodes = rows_under(simulation / "baseline")
    character_rows = []
    for char in ("runner", "vector", "ghost", "array"):
        values = [r for r in episodes if r["character"] == char]
        floors = np.asarray([r["floor"] for r in values], dtype=float)
        styles = {}
        for style in range(8):
            local = [r for r in values if int(r.get("style", 0)) == style]
            styles[str(style)] = {
                "episodes": len(local),
                "winRate": round(100 * sum(bool(r["win"]) for r in local) / max(1, len(local)), 3),
                "floorMean": round(float(np.mean([r["floor"] for r in local])), 3) if local else 0,
            }
        character_rows.append({
            "character": char, "episodes": len(values),
            "winRate": round(100 * sum(bool(r["win"]) for r in values) / max(1, len(values)), 3),
            "floorMean": round(float(floors.mean()), 3),
            "floorP25": round(float(np.percentile(floors, 25)), 3),
            "floorMedian": round(float(np.percentile(floors, 50)), 3),
            "floorP75": round(float(np.percentile(floors, 75)), 3),
            "floorP90": round(float(np.percentile(floors, 90)), 3),
            "styles": styles,
        })
    total_steps = 0
    style_steps = {}
    for style in range(8):
        progress = run / f"style-{style}" / "progress.jsonl"
        last = json.loads(progress.read_text(encoding="utf-8").splitlines()[-1])
        style_steps[str(style)] = last["steps"]
        total_steps += last["steps"]
    changes = json.loads((simulation / "paired_population.json").read_text(encoding="utf-8"))
    archetypes = json.loads((simulation / "discovered" / "archetypes.json").read_text(encoding="utf-8"))
    overview = {
        "schema": 1,
        "run": str(run),
        "totalTrainSteps": total_steps,
        "styleTrainSteps": style_steps,
        "baselineEpisodes": len(episodes),
        "characters": character_rows,
        "balanceChanges": changes,
        "discoveredArchetypes": archetypes["characters"],
    }
    (simulation / "overview.json").write_text(json.dumps(overview, ensure_ascii=False, indent=2), encoding="utf-8")
    with (simulation / "overview.csv").open("w", newline="", encoding="utf-8") as fh:
        fields = ["character", "episodes", "winRate", "floorMean", "floorP25", "floorMedian", "floorP75", "floorP90"]
        writer = csv.DictWriter(fh, fieldnames=fields); writer.writeheader()
        writer.writerows([{k: r[k] for k in fields} for r in character_rows])
    lines = [
        "# NEONSPIRE RL 平衡报告", "",
        f"- 训练步数：{total_steps:,}", f"- baseline 保留局：{len(episodes):,}", "",
        "## 角色基线", "", "| 角色 | 胜率 | 均层 | P25/P50/P75/P90 |", "|---|---:|---:|---:|",
    ]
    for r in character_rows:
        lines.append(f"| {r['character']} | {r['winRate']}% | {r['floorMean']} | {r['floorP25']}/{r['floorMedian']}/{r['floorP75']}/{r['floorP90']} |")
    lines += ["", "## 候选改动（8 策略配对总体）", "", "| 候选 | 角色 | 均层变化 | 胜率变化（百分点） |", "|---|---|---:|---:|"]
    for r in changes:
        lines.append(f"| {r['config']} | {r['character']} | {r['floorDeltaMean']:+.4f} | {r['winRateDeltaPoints']:+.4f} |")
    lines += ["", "流派详情见 `discovered/archetypes.json`；逐局原始数据见各配置的 `style-N/episodes/*.jsonl`。", ""]
    (simulation / "overview.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"overview": str(simulation / 'overview.json'), "steps": total_steps, "episodes": len(episodes)}))


if __name__ == "__main__":
    main()
