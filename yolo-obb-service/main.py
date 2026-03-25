"""
YOLO OBB inference + warped crops for downstream OCR (Gemini in Node).
Weights: YOLO_OBB_WEIGHTS (.pt). If unset/empty and ./best.pt exists next to this file, that is used;
otherwise yolov8n-obb.pt (DOTA pretrained).
"""
import base64
import logging
import os
import traceback

import cv2
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
app = FastAPI(title="YOLO OBB")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _resolve_weights(path: str) -> str:
    """Resolve relative .pt paths: same dir as this file (yolo-obb-service/), repo parent, then cwd."""
    if not path:
        return "yolov8n-obb.pt"
    if os.path.isabs(path) and os.path.isfile(path):
        return path
    if os.path.isfile(path):
        return os.path.abspath(path)
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (
        os.path.join(here, path),
        os.path.join(os.path.dirname(here), path),
        os.path.join(os.getcwd(), path),
    ):
        if os.path.isfile(p):
            return os.path.abspath(p)
    return path


def _initial_weights_spec() -> tuple[str, bool]:
    """Return (spec path, implicit_default). If env unset/empty, prefer ./best.pt when present."""
    v = os.environ.get("YOLO_OBB_WEIGHTS")
    if v is not None and str(v).strip() != "":
        return str(v).strip(), False
    here = os.path.dirname(os.path.abspath(__file__))
    if os.path.isfile(os.path.join(here, "best.pt")):
        return "best.pt", True
    return "yolov8n-obb.pt", True


_raw_weights, _weights_implicit = _initial_weights_spec()
WEIGHTS = _resolve_weights(_raw_weights)
if WEIGHTS != _raw_weights:
    os.environ["YOLO_OBB_WEIGHTS"] = WEIGHTS
    logger.info("Resolved YOLO_OBB_WEIGHTS %r -> %s", _raw_weights, WEIGHTS)
elif _weights_implicit:
    os.environ["YOLO_OBB_WEIGHTS"] = WEIGHTS
    logger.info(
        "YOLO_OBB_WEIGHTS unset; using default weights %r -> %s",
        _raw_weights,
        WEIGHTS,
    )

CONF = float(os.environ.get("YOLO_OBB_CONF", "0.25"))
MAX_DET = int(os.environ.get("YOLO_OBB_MAX_DET", "40"))
CLASS_FILTER = os.environ.get("YOLO_OBB_CLASS_NAMES", "").strip()  # comma-separated, empty = all

_model = None


def get_model():
    global _model
    if _model is None:
        from ultralytics import YOLO

        _model = YOLO(WEIGHTS)
    return _model


def image_to_bgr(content: bytes) -> np.ndarray:
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    if img.ndim == 3 and img.shape[2] == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    return img


def _order_quad_tl_tr_br_bl(pts: np.ndarray) -> np.ndarray:
    pts = np.array(pts, dtype=np.float32)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).flatten()
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(diff)]
    bl = pts[np.argmax(diff)]
    return np.array([tl, tr, br, bl], dtype=np.float32)


def warp_obb_crop(img_bgr: np.ndarray, quad: np.ndarray) -> np.ndarray | None:
    """Unwarp minimum-area rectangle of the OBB quad to axis-aligned crop."""
    pts = quad.astype(np.float32)
    try:
        rect = cv2.minAreaRect(pts)
        box = cv2.boxPoints(rect)
        box = _order_quad_tl_tr_br_bl(box)
        w = int(max(np.linalg.norm(box[0] - box[1]), 4))
        h = int(max(np.linalg.norm(box[0] - box[3]), 4))
        dst = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
        M = cv2.getPerspectiveTransform(box, dst)
        return cv2.warpPerspective(img_bgr, M, (w, h))
    except Exception:
        return None


def encode_jpeg(bgr: np.ndarray, quality: int = 90) -> bytes:
    ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("JPEG encode failed")
    return buf.tobytes()


def run_detect_and_crops(img_bgr: np.ndarray):
    model = get_model()
    h, w = img_bgr.shape[:2]
    results = model.predict(
        source=img_bgr,
        conf=CONF,
        max_det=MAX_DET,
        verbose=False,
        task="obb",
    )
    r = results[0]
    items = []
    if r.obb is None or len(r.obb) == 0:
        logger.info(
            "OBB predict: 0 boxes above conf=%s (weights=%s); if unexpected, check YOLO_OBB_WEIGHTS and YOLO_OBB_CONF",
            CONF,
            WEIGHTS,
        )
        return items

    # r.names can be dict {0: "label"} or list ["label"]
    names_raw = r.names or {}
    names = (
        names_raw
        if isinstance(names_raw, dict)
        else {i: str(n) for i, n in enumerate(names_raw)}
    )
    allowed = None
    if CLASS_FILTER:
        allowed = {s.strip().lower() for s in CLASS_FILTER.split(",") if s.strip()}

    # (n, 4, 2) pixels; some versions return (4, 2) for single det
    xyxyxyxy = r.obb.xyxyxyxy.cpu().numpy()
    if xyxyxyxy.ndim == 2:
        xyxyxyxy = np.expand_dims(xyxyxyxy, axis=0)
    confs = r.obb.conf.cpu().numpy()
    clss = r.obb.cls.cpu().numpy().astype(int)
    if confs.ndim == 0:
        confs = np.array([confs])
    if clss.ndim == 0:
        clss = np.array([clss])

    filtered_class = 0
    warp_failed = 0
    for i in range(len(xyxyxyxy)):
        cname = names.get(int(clss[i]), str(int(clss[i])))
        if allowed is not None and cname.lower() not in allowed:
            filtered_class += 1
            continue
        quad = xyxyxyxy[i]
        poly_norm = []
        for j in range(4):
            poly_norm.append(
                [round(float(quad[j, 0]) / w, 6), round(float(quad[j, 1]) / h, 6)]
            )
        crop = warp_obb_crop(img_bgr, quad)
        if crop is None or crop.size == 0:
            warp_failed += 1
            continue
        crop_b64 = base64.b64encode(encode_jpeg(crop)).decode("ascii")
        items.append(
            {
                "polygon": poly_norm,
                "confidence": round(float(confs[i]), 4),
                "className": cname,
                "cropBase64": crop_b64,
            }
        )
    # Sort by confidence descending
    items.sort(key=lambda x: -x["confidence"])

    n_raw = len(xyxyxyxy)
    if not items and n_raw > 0:
        seen = sorted({names.get(int(clss[i]), str(int(clss[i]))) for i in range(n_raw)})
        if filtered_class == n_raw and allowed is not None:
            logger.warning(
                "All %d OBB detections dropped by YOLO_OBB_CLASS_NAMES=%r (model class names: %s). "
                "Unset YOLO_OBB_CLASS_NAMES or list exact names.",
                n_raw,
                CLASS_FILTER,
                seen,
            )
        elif warp_failed > 0:
            logger.warning(
                "OBB: %d detections from model, %d failed crop/warp, returning 0 items.",
                n_raw,
                warp_failed,
            )
    return items


class Body(BaseModel):
    image: str


@app.post("/obb-crops")
def obb_crops(body: Body):
    try:
        raw = body.image.strip().split(",", 1)[-1] if "base64," in body.image else body.image
        content = base64.b64decode(raw)
        img = image_to_bgr(content)
        items = run_detect_and_crops(img)
        return {"items": items, "weights": WEIGHTS}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        logger.exception("obb-crops failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"{type(e).__name__}: {e}\n{tb}",
        )


@app.get("/health")
def health():
    return {"status": "ok", "weights": WEIGHTS}


@app.on_event("startup")
def warmup():
    try:
        get_model()
        logger.info("Model loaded: %s", WEIGHTS)
    except Exception as e:
        logger.warning("Startup model load failed (will retry on first request): %s", e)
