# Deploying the YOLO OBB service

So that the **deployed** Label Analyser app uses oriented boxes and shows detection count / fallback, you need to run the OBB service somewhere the Node server can reach it, then point the app at it.

## 1. Run the OBB service in production

The service is a FastAPI app. Options:

### Option A: Same host as the Node server

If you run the Node app on a VPS or single server:

```bash
cd yolo-obb-service
# Use the venv and your trained weights
export YOLO_OBB_WEIGHTS=runs/obb/weights/best.pt
export YOLO_OBB_CONF=0.25
# Bind to 0.0.0.0 so it’s reachable; use a process manager (systemd, supervisor) or reverse proxy
.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8766
```

Run this under a process manager (e.g. systemd) or behind nginx so it restarts and stays up. The Node server will call `http://localhost:8766` if it’s on the same machine, or `http://<this-host>:8766` from another.

### Option B: Docker

Example Dockerfile (build and run on any host or cloud):

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
# Copy your weights into the image or mount them at run time
# ENV YOLO_OBB_WEIGHTS=/app/weights/best.pt
EXPOSE 8766
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8766"]
```

Build and run (mount weights if not in image):

```bash
docker build -t yolo-obb-service .
docker run -p 8766:8766 -e YOLO_OBB_WEIGHTS=/weights/best.pt -v /path/to/weights:/weights yolo-obb-service
```

### Option C: PaaS (Railway, Render, Fly.io, etc.)

- **Railway / Render:** Point the service to the `yolo-obb-service` folder, use `uvicorn main:app --host 0.0.0.0 --port $PORT`. Add `YOLO_OBB_WEIGHTS` (e.g. from a built-in volume or URL to download weights). Set the public URL as `YOLO_OBB_SERVICE_URL` in the Node app.
- **Fly.io:** Deploy the Docker image above or use `fly launch` in `yolo-obb-service` and set the generated URL in the Node app.
- **Render:** See **RENDER_DEPLOY.md** for step-by-step instructions.


## 2. Point the main app at the OBB service

In the **deployed** Node app environment, set:

```env
ANALYZE_PIPELINE=yolo-obb
YOLO_OBB_SERVICE_URL=https://your-obb-service.example.com
```

Use the **full URL** (including `https://` if applicable) that the Node server can reach. Restart the Node app after changing env.

## 3. Database migration (for detection count / fallback text)

So the app can store and show “X detections” and “Switched to Gemini (fallback)” in the UI, add the OBB columns. In the **Supabase SQL Editor**, run:

```sql
-- From supabase/migrations/001_obb_metadata.sql
alter table public.label_analyses
  add column if not exists obb_detection_count integer,
  add column if not exists obb_fallback boolean;
```

(If you created the table from the updated `schema.sql` that already includes these columns, you can skip this.)

## 4. What the user sees

- After analysis: **“N detections (YOLO OBB + Gemini per crop).”** or **“No label regions detected; text was extracted using full-image Gemini (fallback).”**
- In History: the same line per analysis when the OBB pipeline was used.

## 5. Checklist

- [ ] OBB service is running and reachable at a URL.
- [ ] `YOLO_OBB_WEIGHTS` points to your trained `best.pt` (in container or on host).
- [ ] Node app has `ANALYZE_PIPELINE=yolo-obb` and `YOLO_OBB_SERVICE_URL=<that URL>`.
- [ ] Migration for `obb_detection_count` and `obb_fallback` has been run in Supabase (if the table was created before these columns existed).
