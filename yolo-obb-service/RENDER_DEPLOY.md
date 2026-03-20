# Deploy YOLO OBB service on Render

## 1. Push your repo

Ensure your code is on GitHub (or GitLab/Bitbucket). The repo should have at the root:

- `main.py`
- `requirements.txt`
- `best.pt`
- `render.yaml` (optional; used for Blueprint deploy)

## 2. Create a Web Service on Render

1. Go to [dashboard.render.com](https://dashboard.render.com) and sign in.
2. Click **New +** → **Web Service**.
3. **Connect** your repository (GitHub/GitLab/Bitbucket). Authorize if needed.
4. Select the **yolo-obb-service** repo (or the repo that contains this folder).

## 3. Configure the service

If the repo root **is** the service (only `main.py`, `requirements.txt`, etc.):

| Field | Value |
|-------|--------|
| **Name** | `yolo-obb-service` (or any name) |
| **Region** | Choose one (e.g. Oregon) |
| **Branch** | `main` (or your default) |
| **Root Directory** | Leave **empty** |
| **Runtime** | **Python 3** |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

If this service lives in a **subfolder** of the repo (e.g. repo root is `label-analyser` and the service is in `yolo-obb-service/`):

| Field | Value |
|-------|--------|
| **Root Directory** | `yolo-obb-service` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

## 4. Environment variables

In **Environment** (left sidebar or during setup), add:

| Key | Value |
|-----|--------|
| `YOLO_OBB_WEIGHTS` | `best.pt` |
| `YOLO_OBB_CONF` | `0.25` (optional) |
| `YOLO_OBB_CLASS_NAMES` | `label` (optional; use your class name) |

## 5. Plan and deploy

- **Free** plan: 750 hours/month, service spins down after ~15 min idle; first request after that has a cold start (30–60s).
- Click **Create Web Service**. Render will build and deploy.
- Wait for the first deploy to finish. The service URL will be like `https://yolo-obb-service-xxxx.onrender.com`.

## 6. Test

- **Health:** open `https://your-service-name.onrender.com/health`  
  Expected: `{"status":"ok","weights":"best.pt"}`.
- **OBB endpoint:** the web app will call `POST .../obb-crops` with a JSON body `{"image": "data:image/...;base64,..."}`.

## 7. Point the web app at it

In your **Label Analyser (web app)** environment (Vercel or `.env`):

```env
ANALYZE_PIPELINE=yolo-obb
YOLO_OBB_SERVICE_URL=https://your-service-name.onrender.com
```

Use your real Render URL (no trailing slash).

---

## Optional: Deploy with Blueprint

If your repo root contains `render.yaml`:

1. **New +** → **Blueprint**.
2. Connect the repo and select it.
3. Render will read `render.yaml` and create the web service. You can override or add env vars in the dashboard.

---

## Troubleshooting

- **Build fails:** Check that `requirements.txt` and `main.py` are in the root (or in the Root Directory you set). Python 3.10–3.12 are recommended.
- **No detections / wrong weights:** Ensure `best.pt` is in the repo (and inside Root Directory if you set one) and `YOLO_OBB_WEIGHTS=best.pt`.
- **Cold start timeout:** The first request after spin-down can take 30–60s. The web app or user may need to wait or retry once.
