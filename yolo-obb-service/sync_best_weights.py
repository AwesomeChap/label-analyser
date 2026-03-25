#!/usr/bin/env python3
"""
Promote trained weights to ./best.pt (the path used by default deploy + YOLO_OBB_WEIGHTS=best.pt).

- With no args: picks the newest file matching runs/**/weights/best.pt under this directory.
- With one arg: copies that file to ./best.pt

Usage:
  ./sync-best-weights.sh
  ./sync-best-weights.sh runs/obb/weights/best.pt
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def find_newest_under_runs(root: Path) -> Path | None:
    runs = root / "runs"
    if not runs.is_dir():
        return None
    candidates = list(runs.rglob("weights/best.pt"))
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy best.pt to yolo-obb-service/best.pt")
    parser.add_argument(
        "source",
        nargs="?",
        help="Explicit path to a best.pt (default: newest runs/**/weights/best.pt)",
    )
    parser.add_argument(
        "-n",
        "--dry-run",
        action="store_true",
        help="Print source and destination only",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    dest = root / "best.pt"

    if args.source:
        src = Path(args.source).expanduser().resolve()
        if not src.is_file():
            print(f"error: not a file: {src}", file=sys.stderr)
            return 1
    else:
        found = find_newest_under_runs(root)
        if not found:
            print(
                "error: no runs/**/weights/best.pt under",
                root,
                "\nTrain first (e.g. ./train.sh) or pass an explicit path.",
                file=sys.stderr,
            )
            return 1
        src = found

    if args.dry_run:
        print(f"{src}\n  -> {dest}")
        return 0

    shutil.copy2(src, dest)
    print(f"Copied\n  {src}\n  -> {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
