#!/usr/bin/env sh
set -eu

export PATH="/opt/venv/bin:$PATH"

# Monolith: always talk to YOLO inside this container (ignore stale Render env).
export YOLO_OBB_SERVICE_URL="http://127.0.0.1:8766"
export YOLO_OBB_WEIGHTS="${YOLO_OBB_WEIGHTS:-best.pt}"
export ANALYZE_PIPELINE="${ANALYZE_PIPELINE:-yolo-obb}"
export SERVE_CLIENT_BUILD="true"

# Make relative weights path resolve from yolo-obb-service directory.
(
  cd /app/yolo-obb-service
  uvicorn main:app --host 127.0.0.1 --port 8766 &
)

# Wait briefly for YOLO service so first API call is less likely to fail.
python3 - <<'PY'
import time
import urllib.request

url = "http://127.0.0.1:8766/health"
for _ in range(60):
    try:
        with urllib.request.urlopen(url, timeout=1):
            break
    except Exception:
        time.sleep(1)
PY

# Start Node API + static frontend server on Render's PORT.
cd /app/web-app/server
exec node index.js
