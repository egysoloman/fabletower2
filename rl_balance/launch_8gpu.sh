#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python}"
OUTPUT_DIR="${1:-$ROOT_DIR/rl_balance/outputs/one-hour-$(date -u +%Y%m%dT%H%M%SZ)}"
TRAIN_MINUTES="${TRAIN_MINUTES:-46}"
ENVS_PER_GPU="${ENVS_PER_GPU:-512}"
SIM_WORKERS="${SIM_WORKERS:-8}"
EVAL_EPISODES="${EVAL_EPISODES:-512}"
CANDIDATES="${CANDIDATES:-$ROOT_DIR/rl_balance/configs/candidates.example.json}"

mkdir -p "$OUTPUT_DIR" "$ROOT_DIR/rl_balance/outputs"
printf '%s\n' "$OUTPUT_DIR" > "$ROOT_DIR/rl_balance/outputs/latest-run.txt"

pids=()
for gpu in $(seq 0 7); do
  style_dir="$OUTPUT_DIR/style-$gpu"
  mkdir -p "$style_dir"
  affinity=()
  if command -v numactl >/dev/null 2>&1; then
    affinity=(numactl --cpunodebind="$((gpu / 4))" --membind="$((gpu / 4))")
  fi
  CUDA_VISIBLE_DEVICES="$gpu" "${affinity[@]}" "$PYTHON_BIN" "$ROOT_DIR/rl_balance/python/train.py" \
      --output "$style_dir" --style "$gpu" --seed "$((20260731 + gpu))" \
      --minutes "$TRAIN_MINUTES" --envs "$ENVS_PER_GPU" --sim-workers "$SIM_WORKERS" \
      >"$style_dir/train.log" 2>&1 &
  pids+=("$!")
done

failed=0
for pid in "${pids[@]}"; do
  wait "$pid" || failed=1
done
if [[ "$failed" -ne 0 ]]; then
  echo "At least one trainer failed. See $OUTPUT_DIR/style-*/train.log" >&2
  exit 1
fi

"$PYTHON_BIN" "$ROOT_DIR/rl_balance/python/simulate.py" \
  --checkpoints "$OUTPUT_DIR" --configs "$CANDIDATES" \
  --output "$OUTPUT_DIR/simulation" --episodes "$EVAL_EPISODES" \
  --gpus 8 --envs 128 --sim-workers 4

echo "RL balance run complete: $OUTPUT_DIR"
