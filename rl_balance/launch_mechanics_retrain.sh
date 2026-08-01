#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python}"
CHECKPOINTS="${1:?usage: launch_mechanics_retrain.sh CHECKPOINTS OUTPUT_DIR}"
OUTPUT_DIR="${2:?usage: launch_mechanics_retrain.sh CHECKPOINTS OUTPUT_DIR}"
TRAIN_MINUTES="${TRAIN_MINUTES:-10}"
ENVS_PER_GPU="${ENVS_PER_GPU:-2048}"
SIM_WORKERS="${SIM_WORKERS:-16}"
EVAL_EPISODES="${EVAL_EPISODES:-1024}"
MINIBATCH="${MINIBATCH:-16384}"
EPOCHS="${EPOCHS:-4}"
CONFIG="${SELECTED_CONFIG:-$ROOT_DIR/rl_balance/configs/mechanics-selected-20260801.json}"
FINALISTS="${FINALISTS_CONFIG:-$ROOT_DIR/rl_balance/configs/mechanics-finalist-20260801.json}"

mkdir -p "$OUTPUT_DIR"
cpus=("0-15" "16-31" "64-79" "80-95" "32-47" "48-63" "96-111" "112-127")
pids=()

for gpu in $(seq 0 7); do
  style_dir="$OUTPUT_DIR/style-$gpu"
  mkdir -p "$style_dir"
  affinity=()
  if command -v taskset >/dev/null 2>&1; then
    affinity=(taskset -c "${cpus[$gpu]}")
  fi
  CUDA_VISIBLE_DEVICES="$gpu" "${affinity[@]}" "$PYTHON_BIN" "$ROOT_DIR/rl_balance/python/train.py" \
    --output "$style_dir" --style "$gpu" --seed "$((20260801 + gpu))" \
    --config "$CONFIG" --resume "$CHECKPOINTS/style-$gpu/final.pt" \
    --minutes "$TRAIN_MINUTES" --envs "$ENVS_PER_GPU" --sim-workers "$SIM_WORKERS" \
    --rollout-steps 64 --minibatch "$MINIBATCH" --epochs "$EPOCHS" \
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

if [[ "${SKIP_EVAL:-0}" != "1" ]]; then
  "$PYTHON_BIN" "$ROOT_DIR/rl_balance/python/simulate.py" \
    --checkpoints "$OUTPUT_DIR" --configs "$FINALISTS" \
    --output "$OUTPUT_DIR/simulation" --episodes "$EVAL_EPISODES" \
    --gpus 8 --envs 512 --sim-workers 16
fi

echo "Mechanics retrain complete: $OUTPUT_DIR"
