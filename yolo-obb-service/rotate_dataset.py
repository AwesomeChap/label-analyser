#!/usr/bin/env python3
"""
Create rotated copies of your existing OBB dataset so you get many absolute
orientations without re-annotating. Annotations are transformed with the same
affine as the image (expanded canvas so nothing is cropped).

Usage:
  .venv/bin/python rotate_dataset.py my_dataset --out my_dataset_rotated
      # default: --step 30 → originals plus _rot30 … _rot330 (12 variants per image)

  .venv/bin/python rotate_dataset.py my_dataset --out my_dataset_rotated --step 90
      # same as legacy: _rot90, _rot180, _rot270 (4 variants per image)

  .venv/bin/python rotate_dataset.py my_dataset --out my_dataset_rotated --angles 45 90

Original images + labels are copied; rotated copies use _rot<DEG> in the filename.
Angles are degrees clockwise (same sense as the old _rot90 = 90° clockwise).
"""
import argparse
import math
import shutil
from pathlib import Path

import cv2
import numpy as np

_BORDER_MODES = {
    "black": cv2.BORDER_CONSTANT,
    "replicate": cv2.BORDER_REPLICATE,
    "reflect": cv2.BORDER_REFLECT_101,
}


def rotate_expand_clockwise(
    img: np.ndarray,
    angle_deg_clockwise: float,
    border: str = "black",
) -> tuple[np.ndarray, np.ndarray, int, int, int, int]:
    """
    Rotate clockwise around image center; expand canvas so no pixels are cropped.
    OpenCV's getRotationMatrix2D uses CCW-positive, so we pass -angle for clockwise.
    Returns warped BGR image, 2x3 affine M, new_w, new_h, orig_w, orig_h.
    """
    h, w = img.shape[:2]
    center = (w / 2.0, h / 2.0)
    M = cv2.getRotationMatrix2D(center, -float(angle_deg_clockwise), 1.0)
    rad = math.radians(angle_deg_clockwise)
    c = abs(math.cos(rad))
    s = abs(math.sin(rad))
    new_w = int(math.ceil(h * s + w * c))
    new_h = int(math.ceil(h * c + w * s))
    M[0, 2] += (new_w / 2.0) - center[0]
    M[1, 2] += (new_h / 2.0) - center[1]
    bmode = _BORDER_MODES.get(border, cv2.BORDER_CONSTANT)
    if bmode == cv2.BORDER_CONSTANT:
        out = cv2.warpAffine(
            img,
            M,
            (new_w, new_h),
            flags=cv2.INTER_LINEAR,
            borderMode=bmode,
            borderValue=(0, 0, 0),
        )
    else:
        out = cv2.warpAffine(
            img,
            M,
            (new_w, new_h),
            flags=cv2.INTER_LINEAR,
            borderMode=bmode,
        )
    return out, M, new_w, new_h, w, h


def transform_norm_pts_affine(
    pts: list[tuple[float, float]],
    M: np.ndarray,
    orig_w: int,
    orig_h: int,
    new_w: int,
    new_h: int,
) -> list[tuple[float, float]]:
    """Map normalized corners on original image to normalized coords on rotated canvas."""
    out: list[tuple[float, float]] = []
    for nx, ny in pts:
        x = nx * orig_w
        y = ny * orig_h
        xp = M[0, 0] * x + M[0, 1] * y + M[0, 2]
        yp = M[1, 0] * x + M[1, 1] * y + M[1, 2]
        out.append(
            (
                min(max(xp / new_w, 0.0), 1.0),
                min(max(yp / new_h, 0.0), 1.0),
            )
        )
    return out


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


def write_obb_label(path: Path, boxes: list[tuple[str, list[tuple[float, float]]]]):
    """boxes = [(class_id, [(x,y), (x,y), (x,y), (x,y)]), ...]"""
    lines = []
    for cid, pts in boxes:
        coords = " ".join(f"{x:.6f} {y:.6f}" for x, y in pts)
        lines.append(f"{cid} {coords}")
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(
        description="Rotate OBB dataset (image + labels); expanded canvas + affine labels."
    )
    ap.add_argument("dataset", help="Path to dataset root (has images/train, labels/train, etc.)")
    ap.add_argument("--out", "-o", required=True, help="Output dataset root (will create)")
    ap.add_argument(
        "--step",
        type=int,
        default=30,
        help="When --angles is omitted: rotate at step, 2*step, …, 360-step (default: 30 → 11 copies + original = 12)",
    )
    ap.add_argument(
        "--angles",
        nargs="+",
        type=float,
        default=None,
        help="Explicit clockwise angles in degrees (e.g. 90 180 270). Overrides --step.",
    )
    ap.add_argument(
        "--border",
        choices=("black", "replicate", "reflect"),
        default="black",
        help="Fill outside rotated image: black (default), replicate (extends edges; closer to real trays), reflect.",
    )
    args = ap.parse_args()

    src = Path(args.dataset)
    dst = Path(args.out)
    if not src.is_dir():
        print(f"Error: not a directory: {src}")
        return 1

    if args.angles is not None:
        angles = args.angles
    else:
        if args.step <= 0 or args.step >= 360:
            print("Error: --step must be between 1 and 359")
            return 1
        angles = list(range(args.step, 360, args.step))

    for angle in angles:
        if angle == 0 or angle >= 360 or angle <= -360:
            print(f"Error: each angle must be non-zero and within one turn; got {angle}")
            return 1
        if angle < 0:
            print(f"Error: use positive clockwise angles (got {angle})")
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

            for angle in angles:
                img_rot, M, nw, nh, ow, oh = rotate_expand_clockwise(
                    img, float(angle), border=args.border
                )
                deg_int = int(round(angle))
                is_whole = abs(float(angle) - float(deg_int)) < 1e-6
                suffix = f"_rot{deg_int}" if is_whole else f"_rot{angle:g}".replace(".", "p")
                out_stem = stem + suffix
                out_img = img_dir_dst / f"{out_stem}{img_path.suffix}"
                cv2.imwrite(str(out_img), img_rot)

                boxes_rot = [
                    (
                        cid,
                        transform_norm_pts_affine(pts, M, ow, oh, nw, nh),
                    )
                    for cid, pts in boxes_orig
                ]
                write_obb_label(lbl_dir_dst / f"{out_stem}.txt", boxes_rot)

    # data.yaml
    (dst / "data.yaml").write_text(f"""# Generated by rotate_dataset.py from {src.name} (border={args.border})
path: {dst.resolve()}
train: images/train
val: images/val

names:
  0: label
""", encoding="utf-8")

    n_variants = 1 + len(angles)
    print(f"Done. Original + {len(angles)} rotated copies per image ({n_variants} variants) -> {dst}")
    print(f"Angles (deg clockwise): {angles}")
    print(f"Then (from yolo-obb-service): ./train.sh {dst}/data.yaml")


if __name__ == "__main__":
    raise SystemExit(main() or 0)
