#!/usr/bin/env python3
"""
Create rotated copies of your existing OBB dataset (90°, 180°, 270°) so you get
horizontal / sideways layouts without re-annotating. Annotations are transformed
automatically.

Usage:
  .venv/bin/python rotate_dataset.py my_dataset --out my_dataset_rotated
  .venv/bin/python rotate_dataset.py my_dataset --out my_dataset_rotated --angles 90 270

Original images + labels are copied; then for each image we add rotated versions
with _rot90, _rot180, _rot270 in the filename. Use the output folder for training.

Corner transforms follow the same pixel mapping as cv2.rotate (width/height aware),
not the simplified (y, 1-x) normalized shortcut, so overlays align on the rotated images.
If you generated a rotated dataset with an older version of this script, regenerate it.
"""
import argparse
import shutil
from pathlib import Path

import cv2

# Normalized OBB corners must match cv2.rotate pixel mapping (not the continuous (y,1-x) shortcut).
ALLOWED_ANGLES = frozenset({90, 180, 270})


def norm_xy_after_rotate_90_cw(nx: float, ny: float, w: int, h: int) -> tuple[float, float]:
    """Same as cv2.rotate(img, ROTATE_90_CLOCKWISE); original size w×h → rotated h×w."""
    x_old, y_old = nx * w, ny * h
    x_new = h - 1 - y_old
    y_new = x_old
    w_new, h_new = h, w
    return x_new / w_new, y_new / h_new


def norm_xy_after_rotate_180(nx: float, ny: float, w: int, h: int) -> tuple[float, float]:
    x_old, y_old = nx * w, ny * h
    x_new = w - 1 - x_old
    y_new = h - 1 - y_old
    return x_new / w, y_new / h


def norm_xy_after_rotate_90_ccw(nx: float, ny: float, w: int, h: int) -> tuple[float, float]:
    """Same as cv2.rotate(img, ROTATE_90_COUNTERCLOCKWISE); script uses this for angle=270."""
    x_old, y_old = nx * w, ny * h
    x_new = y_old
    y_new = w - 1 - x_old
    w_new, h_new = h, w
    return x_new / w_new, y_new / h_new


def transform_norm_xy(nx: float, ny: float, angle: int, w: int, h: int) -> tuple[float, float]:
    if angle == 90:
        return norm_xy_after_rotate_90_cw(nx, ny, w, h)
    if angle == 180:
        return norm_xy_after_rotate_180(nx, ny, w, h)
    if angle == 270:
        return norm_xy_after_rotate_90_ccw(nx, ny, w, h)
    raise ValueError(angle)


def parse_obb_line(line: str) -> list[tuple[str, list[tuple[float, float]]]]:
    """Parse one line: class_id x1 y1 x2 y2 x3 y3 x4 y4. Returns [(class_id, [(x,y), ...])]."""
    toks = line.strip().split()
    if len(toks) < 9:
        return []
    cid = toks[0]
    pts = []
    for i in range(1, 9, 2):
        x, y = float(toks[i]), float(toks[i + 1])
        pts.append((x, y))
    return [(cid, pts)]


def transform_pts(
    pts: list[tuple[float, float]], angle: int, w: int, h: int
) -> list[tuple[float, float]]:
    return [transform_norm_xy(x, y, angle, w, h) for x, y in pts]


def write_obb_label(path: Path, boxes: list[tuple[str, list[tuple[float, float]]]]):
    """boxes = [(class_id, [(x,y), (x,y), (x,y), (x,y)]), ...]"""
    lines = []
    for cid, pts in boxes:
        coords = " ".join(f"{x:.6f} {y:.6f}" for x, y in pts)
        lines.append(f"{cid} {coords}")
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description="Rotate OBB dataset (image + labels) by 90/180/270°.")
    ap.add_argument("dataset", help="Path to dataset root (has images/train, labels/train, etc.)")
    ap.add_argument("--out", "-o", required=True, help="Output dataset root (will create)")
    ap.add_argument("--angles", nargs="+", type=int, default=[90, 180, 270],
                    help="Angles to add (default: 90 180 270)")
    args = ap.parse_args()

    src = Path(args.dataset)
    dst = Path(args.out)
    if not src.is_dir():
        print(f"Error: not a directory: {src}")
        return 1

    for angle in args.angles:
        if angle not in ALLOWED_ANGLES:
            print(f"Error: angle must be one of {sorted(ALLOWED_ANGLES)}, got {angle}")
            return 1

    for split in ("train", "val"):
        img_dir_src = src / "images" / split
        lbl_dir_src = src / "labels" / split
        img_dir_dst = dst / "images" / split
        lbl_dir_dst = dst / "labels" / split
        img_dir_dst.mkdir(parents=True, exist_ok=True)
        lbl_dir_dst.mkdir(parents=True, exist_ok=True)

        if not img_dir_src.is_dir():
            continue

        for img_path in img_dir_src.iterdir():
            if not img_path.is_file():
                continue
            if img_path.suffix.lower() not in (".jpg", ".jpeg", ".png", ".bmp", ".webp"):
                continue
            stem = img_path.stem
            lbl_path_src = lbl_dir_src / f"{stem}.txt"

            # Copy original
            shutil.copy2(img_path, img_dir_dst / img_path.name)
            if lbl_path_src.exists():
                shutil.copy2(lbl_path_src, lbl_dir_dst / f"{stem}.txt")

            img = cv2.imread(str(img_path))
            if img is None:
                print(f"Skip (cannot read image): {img_path}")
                continue

            # Parse original labels
            boxes_orig = []
            if lbl_path_src.exists():
                for line in lbl_path_src.read_text(encoding="utf-8").strip().splitlines():
                    for cid, pts in parse_obb_line(line):
                        if len(pts) == 4:
                            boxes_orig.append((cid, pts))

            h, w = img.shape[:2]

            for angle in args.angles:
                if angle == 90 or angle == 270:
                    img_rot = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE if angle == 90 else cv2.ROTATE_90_COUNTERCLOCKWISE)
                else:
                    img_rot = cv2.rotate(img, cv2.ROTATE_180)
                suffix = f"_rot{angle}"
                out_stem = stem + suffix
                out_img = img_dir_dst / f"{out_stem}{img_path.suffix}"
                cv2.imwrite(str(out_img), img_rot)

                boxes_rot = [(cid, transform_pts(pts, angle, w, h)) for cid, pts in boxes_orig]
                write_obb_label(lbl_dir_dst / f"{out_stem}.txt", boxes_rot)

    # data.yaml
    (dst / "data.yaml").write_text(f"""# Generated by rotate_dataset.py from {src.name}
path: {dst.resolve()}
train: images/train
val: images/val

names:
  0: label
""", encoding="utf-8")

    print(f"Done. Original + rotated copies written to {dst}")
    print(f"Train: list({dst / 'images' / 'train'} with ..._rot90, _rot180, _rot270)")
    print(f"Then (from yolo-obb-service): ./train.sh {dst}/data.yaml")


if __name__ == "__main__":
    raise SystemExit(main() or 0)
