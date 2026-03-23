# YOLO oriented bounding boxes (Ultralytics)

This service runs **YOLOv8-OBB** (rotated boxes), returns each detection as a **normalized polygon** and a **warped JPEG crop** for the Node app to send to **Gemini** for text.

## Pretrained vs your labels

| Weights | What it detects |
|--------|------------------|
| **`yolov8n-obb.pt`** (default, auto-download) | Trained on **DOTA** (aerial): planes, ships, vehicles, etc. **Not** small lab labels — you will usually get **no boxes** on label photos, and the app will **fall back to full-image Gemini**. |
| **Your `best.pt`** after training | One class e.g. `label` on **your** images → oriented boxes around each sticker. **This is what you want** for better OBB on your trays. |

**Step-by-step training guide:** see **[TRAINING.md](TRAINING.md)** in this folder (annotate → dataset layout → `yolo obb train` → plug in `best.pt`).

Official docs: [Ultralytics OBB](https://docs.ultralytics.com/tasks/obb/).

## Setup

```bash
cd yolo-obb-service
python3.11 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Optional env (defaults shown):

| Env | Meaning |
|-----|---------|
| `YOLO_OBB_WEIGHTS` | Path or model name (default `yolov8n-obb.pt`) |
| `YOLO_OBB_CONF` | Min confidence (default `0.25`) |
| `YOLO_OBB_MAX_DET` | Max detections per image (default `40`) |
| `YOLO_OBB_CLASS_NAMES` | Comma list, e.g. `label` — only those classes; empty = all |

Run (must use the **venv** so `ultralytics` is on `PYTHONPATH` — global `uvicorn` will fail with `No module named 'ultralytics'`):

```bash
./run.sh
```

Or explicitly:

```bash
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8766
```

**Why Docker works but bare terminal doesn’t:** the image runs `pip install -r requirements.txt`. Locally you need the same install inside `.venv` (see Setup above). If you see `No module named 'ultralytics'`, recreate the venv and reinstall:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
./run.sh
```

## App wiring

This service is **standalone**. The main **web app** (separate repo/deploy) calls it over HTTP. In the **web app’s** server environment (e.g. `server/.env`):

```env
ANALYZE_PIPELINE=yolo-obb
YOLO_OBB_SERVICE_URL=http://127.0.0.1:8766
```

The web app keeps `GOOGLE_GEMINI_API_KEY` — it sends each crop to Gemini. Optional: `YOLO_OBB_GEMINI_CONCURRENCY=4`.

## Flow

1. User uploads image → Node sends bytes to `/obb-crops`.
2. YOLO returns polygons + base64 crops.
3. If **zero** detections → Node uses **full-image Gemini** (same as before).
4. If **some** detections → Gemini runs **per crop**; UI shows **oriented polygons** + combined text.
