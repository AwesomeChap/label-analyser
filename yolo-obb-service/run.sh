#!/usr/bin/env bash
# Run the OBB service with the venv's Python (so ultralytics is found).
cd "$(dirname "$0")"
if [ ! -d ".venv" ]; then
  echo "No .venv found. Create it first:"
  echo "  python3 -m venv .venv"
  echo "  .venv/bin/pip install -r requirements.txt"
  exit 1
fi
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8766 "$@"
