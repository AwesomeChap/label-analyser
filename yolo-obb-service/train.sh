#!/usr/bin/env bash
# Train OBB and save runs/ inside yolo-obb-service (not project root).
# Usage: ./train.sh [data.yaml] [extra yolo args...]
#
# Large synthetic rotation sets (--step 15 → ~24× images): use more epochs and/or
# train-time jitter, e.g.  ./train.sh data.yaml epochs=200 degrees=10
# (Ultralytics default degrees=0 in logs — without jitter, discrete rotations alone may underfit.)
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
if [ ! -d ".venv" ]; then
  echo "No .venv found. Create it first:"
  echo "  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
DATA="${1:-my_dataset_rotated/data.yaml}"
shift
# Force runs to be saved in yolo-obb-service/runs (project=..., name=obb)
set +e
.venv/bin/yolo obb train data="$DATA" model=yolov8n-obb.pt epochs=100 imgsz=640 batch=8 project="$ROOT/runs" name=obb "$@"
rc=$?
set -e
if [ "$rc" -eq 0 ]; then
  echo ""
  echo "Promoting weights to ./best.pt (YOLO_OBB_WEIGHTS=best.pt locally / in Docker)..."
  .venv/bin/python "$ROOT/sync_best_weights.py" || exit $?
fi
exit "$rc"
