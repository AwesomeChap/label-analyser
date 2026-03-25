#!/usr/bin/env bash
# Copy newest runs/**/weights/best.pt to ./best.pt (or pass explicit path).
# Uses .venv Python when present.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PY=python3
if [ -x ".venv/bin/python" ]; then
  PY=".venv/bin/python"
fi
exec "$PY" sync_best_weights.py "$@"
