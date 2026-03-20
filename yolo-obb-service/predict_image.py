#!/usr/bin/env python3
"""
Run YOLO OBB on a single image (same weights as the service). Use this to verify
weights and detections from the command line.

Usage:
  .venv/bin/python predict_image.py path/to/image.jpg
  .venv/bin/python predict_image.py path/to/image.jpg --out result.jpg
  YOLO_OBB_WEIGHTS=runs/obb/weights/best.pt .venv/bin/python predict_image.py image.jpg
"""
import argparse
import os
import sys


def main():
    ap = argparse.ArgumentParser(description="YOLO OBB predict on one image (same weights as service).")
    ap.add_argument("image", help="Path to input image")
    ap.add_argument("--out", "-o", default="obb_predict.jpg", help="Output image with boxes (default: obb_predict.jpg)")
    ap.add_argument("--conf", type=float, default=None, help="Confidence threshold (default: from YOLO_OBB_CONF or 0.25)")
    args = ap.parse_args()

    if not os.path.isfile(args.image):
        print(f"Error: not a file: {args.image}", file=sys.stderr)
        sys.exit(1)

    weights = os.environ.get("YOLO_OBB_WEIGHTS", "yolov8n-obb.pt")
    conf = args.conf if args.conf is not None else float(os.environ.get("YOLO_OBB_CONF", "0.25"))

    print(f"Weights: {weights}")
    print(f"Confidence threshold: {conf}")
    if not os.path.isfile(weights):
        print(f"Warning: weights file not found at {weights}", file=sys.stderr)

    from ultralytics import YOLO

    model = YOLO(weights)
    results = model.predict(source=args.image, conf=conf, verbose=False)
    r = results[0]

    if r.obb is None or len(r.obb) == 0:
        print("Detections: 0")
        print("No boxes to draw. Try --conf 0.15 or a different image.")
        return

    n = len(r.obb)
    print(f"Detections: {n}")
    confs = r.obb.conf.cpu().numpy()
    clss = r.obb.cls.cpu().numpy()
    names_raw = r.names or {}
    names = names_raw if isinstance(names_raw, dict) else {i: str(n) for i, n in enumerate(names_raw)}
    for i in range(n):
        c = int(clss[i])
        name = names.get(c, str(c))
        print(f"  {i+1}. class={name} conf={float(confs[i]):.3f}")

    # Save visualization with all detections on this image
    r.save(filename=args.out)
    print(f"Saved: {args.out}")


if __name__ == "__main__":
    main()
