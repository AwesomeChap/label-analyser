#!/usr/bin/env python3
"""
Draw OBB labels on one image to verify rotated annotations align.
Usage: .venv/bin/python check_rotated_labels.py my_dataset_rotated/images/train/SOME_rot90.jpg
(Label file SOMETHING_rot90.txt must exist in labels/train.)
"""
import sys
from pathlib import Path

import cv2
import numpy as np


def main():
    if len(sys.argv) < 2:
        print("Usage: check_rotated_labels.py <path_to_image>")
        print("Example: check_rotated_labels.py my_dataset_rotated/images/train/X_rot90.jpg")
        return 1
    img_path = Path(sys.argv[1])
    if not img_path.is_file():
        print(f"Not a file: {img_path}")
        return 1
    # Infer label path: .../images/train/X.jpg -> .../labels/train/X.txt
    lbl_path = img_path.parent.parent / "labels" / img_path.parent.name / f"{img_path.stem}.txt"
    if not lbl_path.exists():
        print(f"Label file not found: {lbl_path}")
        return 1

    img = cv2.imread(str(img_path))
    if img is None:
        print("Cannot read image")
        return 1
    h, w = img.shape[:2]

    for line in lbl_path.read_text().strip().splitlines():
        toks = line.split()
        if len(toks) < 9:
            continue
        pts = []
        for i in range(1, 9, 2):
            x, y = float(toks[i]), float(toks[i + 1])
            pts.append((int(x * w), int(y * h)))
        pts = np.array(pts, dtype=np.int32)
        cv2.polylines(img, [pts], True, (0, 255, 0), 2)

    out = img_path.parent / f"{img_path.stem}_with_boxes.jpg"
    cv2.imwrite(str(out), img)
    print(f"Saved: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
