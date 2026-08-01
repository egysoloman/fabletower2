from __future__ import annotations

import argparse
import csv
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np


FEATURES = [
    "attackShare", "skillShare", "powerShare", "zeroCostShare",
    "damagePerTurn", "blockPerTurn", "drawPerTurn", "energyPerTurn",
    "healPerCombat", "corruptPerTurn", "heatPerTurn", "ventPerTurn",
    "stancePerTurn", "turretPerTurn", "platingPerTurn", "viralPerTurn",
    "focusPerTurn", "summonPerCombat", "potionsPerCombat", "eliteShare",
    "shopShare", "restShare", "upgradesPerFloor", "removalsPerFloor",
    "cardPickRate", "maxCardsTurn", "turnsPerCombat", "hpLostPerCombat",
]
STARTERS = {
    "strike", "defend", "spike", "spark", "heatshield", "ventblade", "stoke",
    "phaseblade", "cloakfield", "redshift", "blackout", "pulsebolt", "fieldwall",
    "deployturret", "deployplating",
}


def args_parser() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Discover successful build clusters from episode exports")
    p.add_argument("inputs", nargs="+", help="episode JSONL files or directories")
    p.add_argument("--output", required=True)
    p.add_argument("--clusters", type=int, default=0, help="0 selects 2..8 by approximate silhouette")
    p.add_argument("--min-floor", type=int, default=16)
    p.add_argument("--seed", type=int, default=123)
    return p.parse_args()


def load_rows(inputs: list[str]) -> list[dict]:
    paths: list[Path] = []
    for raw in inputs:
        p = Path(raw)
        paths.extend(sorted(p.rglob("*.jsonl")) if p.is_dir() else [p])
    rows: list[dict] = []
    for path in paths:
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                if "behavior" in row and "character" in row:
                    rows.append(row)
    return rows


def kmeans(x: np.ndarray, k: int, rng: np.random.Generator, rounds: int = 80):
    centers = [x[rng.integers(len(x))]]
    for _ in range(1, k):
        distance = np.min(np.stack([((x - c) ** 2).sum(1) for c in centers]), axis=0)
        total = distance.sum()
        centers.append(x[rng.choice(len(x), p=distance / total)] if total > 0 else x[rng.integers(len(x))])
    centers = np.stack(centers)
    labels = np.full(len(x), -1, dtype=np.int64)
    for _ in range(rounds):
        new_labels = ((x[:, None, :] - centers[None, :, :]) ** 2).sum(2).argmin(1)
        if np.array_equal(labels, new_labels):
            break
        labels = new_labels
        for i in range(k):
            if np.any(labels == i):
                centers[i] = x[labels == i].mean(0)
    return labels, centers


def silhouette(x: np.ndarray, labels: np.ndarray, rng: np.random.Generator) -> float:
    if len(x) > 1200:
        ix = rng.choice(len(x), 1200, replace=False)
        x, labels = x[ix], labels[ix]
    dist = np.sqrt(((x[:, None, :] - x[None, :, :]) ** 2).sum(2))
    scores = []
    for i in range(len(x)):
        own = labels == labels[i]
        if own.sum() <= 1:
            continue
        a = dist[i, own].sum() / (own.sum() - 1)
        b = min(dist[i, labels == label].mean() for label in set(labels) if label != labels[i])
        scores.append((b - a) / max(a, b, 1e-9))
    return float(np.mean(scores)) if scores else -1


def behavior_vector(row: dict) -> list[float]:
    b = row["behavior"]
    cards = max(1.0, float(b.get("cardsPlayed", 0)))
    turns = max(1.0, float(b.get("turns", 0)))
    combats = max(1.0, float(b.get("combats", 0)))
    floor = max(1.0, float(row.get("floor", 0)))
    picks = float(b.get("cardPicks", 0)); skips = float(b.get("cardSkips", 0))
    values = [
        b.get("attacks", 0) / cards, b.get("skills", 0) / cards,
        b.get("powers", 0) / cards, b.get("zeroCost", 0) / cards,
        b.get("damage", 0) / turns, b.get("block", 0) / turns,
        b.get("draw", 0) / turns, b.get("energy", 0) / turns,
        b.get("heal", 0) / combats, b.get("corrupt", 0) / turns,
        b.get("heat", 0) / turns, b.get("vent", 0) / turns,
        b.get("stance", 0) / turns, b.get("turret", 0) / turns,
        b.get("plating", 0) / turns, b.get("viral", 0) / turns,
        b.get("focus", 0) / turns, b.get("summon", 0) / combats,
        b.get("potions", 0) / combats, b.get("elites", 0) / floor,
        b.get("shops", 0) / floor, b.get("rests", 0) / floor,
        b.get("upgrades", 0) / floor, b.get("removals", 0) / floor,
        picks / max(1.0, picks + skips), b.get("maxCardsTurn", 0),
        turns / combats, b.get("hpLost", 0) / combats,
    ]
    return [math.log1p(max(0.0, float(v))) for v in values]


def cluster_character(rows: list[dict], forced_k: int, rng: np.random.Generator) -> tuple[np.ndarray, int, np.ndarray]:
    x = np.asarray([behavior_vector(row) for row in rows], dtype=np.float64)
    mean, std = x.mean(0), x.std(0)
    z = (x - mean) / np.where(std < 1e-6, 1, std)
    if len(rows) < 8:
        return np.zeros(len(rows), dtype=np.int64), 1, z
    if forced_k:
        labels, _ = kmeans(z, min(forced_k, len(rows)), rng)
        return labels, int(labels.max() + 1), z
    best = (-2.0, None, 1)
    for k in range(2, min(8, int(math.sqrt(len(rows))) + 2, len(rows)) + 1):
        labels, _ = kmeans(z, k, rng)
        score = silhouette(z, labels, rng)
        if score > best[0]:
            best = (score, labels.copy(), k)
    return best[1] if best[1] is not None else np.zeros(len(rows), dtype=np.int64), best[2], z


def main() -> None:
    args = args_parser()
    rng = np.random.default_rng(args.seed)
    all_rows = load_rows(args.inputs)
    selected = [r for r in all_rows if r.get("win") or r.get("floor", 0) >= args.min_floor]
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    result = {"schema": 1, "sourceEpisodes": len(all_rows), "selectedEpisodes": len(selected), "characters": {}}
    csv_rows = []
    for char in ("runner", "vector", "ghost", "array"):
        rows = [r for r in selected if r["character"] == char]
        if not rows:
            continue
        labels, k, z = cluster_character(rows, args.clusters, rng)
        clusters = []
        for label in range(k):
            ix = np.where(labels == label)[0]
            if len(ix) == 0:
                continue
            local = [rows[i] for i in ix]
            signature = z[ix].mean(0)
            top_features = [
                {"name": FEATURES[i], "z": round(float(signature[i]), 3)}
                for i in np.argsort(signature)[::-1][:6]
            ]
            inside = Counter(card["id"] for row in local for card in row["deck"] if card["id"] not in STARTERS)
            outside_rows = [rows[i] for i in range(len(rows)) if labels[i] != label]
            outside = Counter(card["id"] for row in outside_rows for card in row["deck"] if card["id"] not in STARTERS)
            associations = []
            for card, count in inside.items():
                presence = sum(any(c["id"] == card for c in row["deck"]) for row in local)
                if presence < max(2, len(local) * 0.05):
                    continue
                in_rate = (presence + 1) / (len(local) + 2)
                out_presence = sum(any(c["id"] == card for c in row["deck"]) for row in outside_rows)
                out_rate = (out_presence + 1) / (len(outside_rows) + 2)
                associations.append({"card": card, "lift": round(in_rate / out_rate, 3), "presence": presence})
            associations.sort(key=lambda x: (x["lift"], x["presence"]), reverse=True)
            cluster = {
                "id": f"{char}-discovered-{label + 1}",
                "episodes": len(local),
                "winRate": round(100 * sum(bool(r["win"]) for r in local) / len(local), 3),
                "floorMean": round(float(np.mean([r["floor"] for r in local])), 3),
                "styles": dict(Counter(str(r.get("style", 0)) for r in local)),
                "signature": top_features,
                "keyCards": associations[:12],
            }
            clusters.append(cluster)
            csv_rows.append({
                "character": char, "cluster": cluster["id"], "episodes": len(local),
                "winRate": cluster["winRate"], "floorMean": cluster["floorMean"],
                "signature": ";".join(x["name"] for x in top_features),
                "keyCards": ";".join(x["card"] for x in associations[:12]),
            })
        result["characters"][char] = {"clusters": clusters}
    (output / "archetypes.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    with (output / "archetypes.csv").open("w", newline="", encoding="utf-8") as fh:
        fields = ["character", "cluster", "episodes", "winRate", "floorMean", "signature", "keyCards"]
        writer = csv.DictWriter(fh, fieldnames=fields); writer.writeheader(); writer.writerows(csv_rows)
    print(json.dumps({"output": str(output), "selected": len(selected), "clusters": len(csv_rows)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
