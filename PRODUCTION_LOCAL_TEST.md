# Test production-like deploy locally (Docker monolith)

This matches what Render runs: one container with YOLO on `127.0.0.1:8766`, Node on `PORT`, frontend served by Express.

## 1. Build

From repo root (`label-analyser/`):

```bash
docker build -t label-analyser-monolith .
```

If uvicorn fails with `ImportError: libxcb.so.1`, rebuild after pulling latest `Dockerfile` (OpenCV runtime packages were added for slim Debian).

## 2. Run (pass secrets like on Render)

Create a file `render-local.env` (do not commit) with:

```env
PORT=10000
GOOGLE_GEMINI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_BUCKET_NAME=label-images
ANALYZE_PIPELINE=yolo-obb
YOLO_OBB_WEIGHTS=best.pt
```

Run:

```bash
docker run --rm -p 10000:10000 --env-file render-local.env label-analyser-monolith
```

**Blank page?** The **right** side of `-p HOST:CONTAINER` must match **`PORT`** inside the container. If `PORT` is unset, Express defaults to **3001**, so use `-p 10000:3001` or set `PORT=10000` in `render-local.env`.

## 3. Checks

Open in browser or curl:

| URL | Expected |
|-----|----------|
| `http://localhost:10000/api/health` | `{"ok":true}` |
| `http://localhost:10000/api/health/obb` | `yoloReachable: true`, `yoloHealth` includes `status: "ok"` and correct `weights` |
| `http://localhost:10000/` | SPA loads |

If `/api/health/obb` returns **503** with `yoloError`, YOLO failed inside the container (OOM, missing `best.pt` in image, or model load error — check `docker logs`).

## 4. Common production-only issues

1. **Stale `YOLO_OBB_SERVICE_URL` on Render** pointing at an old external URL. The monolith startup script now **forces** `http://127.0.0.1:8766`; remove any external URL from Render env to avoid confusion.
2. **`best.pt` not in the Git repo** → Docker image has no weights. Ensure `yolo-obb-service/best.pt` is committed (or adjust image copy).
3. **Free tier RAM** too low for PyTorch + YOLO → container crashes or OOM; logs will show it.
4. **First request after sleep** is slow; that is one cold start for the whole app.

## 5. Logs

```bash
docker logs <container_id> 2>&1 | tail -100
```

Look for uvicorn / ultralytics errors before Node starts.
