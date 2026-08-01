#!/usr/bin/env bash
set -euo pipefail

# Run inside a copied NEONSPIRE repository on a clean Alibaba GPU image.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="${RUNTIME_DIR:-/opt/neonspire-rl/runtime}"
NODE_VERSION="${NODE_VERSION:-22.18.0}"
MINIFORGE_URL="https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh"

mkdir -p "$RUNTIME_DIR"
if [[ ! -x "$RUNTIME_DIR/node/bin/node" ]]; then
  curl -fL --retry 4 "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o "$RUNTIME_DIR/node.tar.xz"
  mkdir -p "$RUNTIME_DIR/node"
  tar -xJf "$RUNTIME_DIR/node.tar.xz" -C "$RUNTIME_DIR/node" --strip-components=1
  rm -f "$RUNTIME_DIR/node.tar.xz"
fi
export PATH="$RUNTIME_DIR/node/bin:$PATH"

if [[ ! -x "$RUNTIME_DIR/conda/bin/python" ]]; then
  curl -fL --retry 4 "$MINIFORGE_URL" -o "$RUNTIME_DIR/miniforge.sh"
  bash "$RUNTIME_DIR/miniforge.sh" -b -p "$RUNTIME_DIR/conda"
  rm -f "$RUNTIME_DIR/miniforge.sh"
fi
PYTHON_BIN="$RUNTIME_DIR/conda/bin/python"

cd "$ROOT_DIR"
npm ci --ignore-scripts
"$PYTHON_BIN" -m pip install --no-cache-dir numpy
"$PYTHON_BIN" -m pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cu128

PATH="$RUNTIME_DIR/node/bin:$PATH" "$PYTHON_BIN" rl_balance/tests/smoke_protocol.py
"$PYTHON_BIN" - <<'PY'
import torch
assert torch.cuda.device_count() == 8, torch.cuda.device_count()
for i in range(8):
    x = torch.ones((1024, 1024), device=f"cuda:{i}")
    assert float((x @ x).mean()) == 1024.0
print("CUDA smoke OK:", torch.__version__, torch.version.cuda, torch.cuda.device_count())
PY

echo "Bootstrap complete."
echo "export PATH=$RUNTIME_DIR/node/bin:\$PATH"
echo "export PYTHON_BIN=$PYTHON_BIN"
