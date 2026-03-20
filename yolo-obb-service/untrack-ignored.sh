#!/bin/bash
# Run from repo root (parent of yolo-obb-service in a monorepo, or inside yolo-obb-service if it's the root).
# Stops tracking ignored paths; files stay on disk.

set -e
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [ -d "yolo-obb-service" ]; then
  P="yolo-obb-service/"
else
  P=""
fi

for path in ".venv" "venv" "__pycache__" ".env" "runs" "my_dataset" "my_dataset_rotated"; do
  git rm -r --cached "${P}${path}" 2>/dev/null || true
done
git ls-files "${P}.env.*" 2>/dev/null | while read f; do git rm --cached "$f" 2>/dev/null || true; done

echo "Done. Run: git status"
echo "Then: git commit -m 'Stop tracking venv, env, runs, datasets' && git push"
