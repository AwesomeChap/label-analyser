# Label Analyser

A full-stack web app that analyses labels on small boxes from images. Users can upload images or capture them with the camera. The app uses **Google Gemini** to extract text (QR codes and barcodes ignored) and returns bounding boxes and full text. Results and compressed images are stored in **Supabase**.

Same structure and design as [wine-label-analyser](https://github.com/your-org/wine-label-analyser): Analyse page (single or multiple images, camera, custom prompt), History page (collapse/expand, extracted text, image with boxes, editable prompt, re-analyse, delete).

## Stack

- **Frontend:** React (Vite), React Router, Tailwind CSS
- **Backend:** Node.js (Express)
- **AI:** Google Gemini (vision) for label text extraction
- **Database & storage:** Supabase (PostgreSQL + Storage)

## Setup

### 1. Clone and install

```bash
cd web-app
npm run install:all
```

### 2. Environment variables

**Server** – copy and edit `server/.env`:

```bash
cp server/.env.example server/.env
```

Fill in:

| Variable | Description |
|----------|-------------|
| `GOOGLE_GEMINI_API_KEY` | Your Google Gemini API key (for vision) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only; keep secret) |
| `SUPABASE_BUCKET_NAME` | Storage bucket name (e.g. `label-images`) |
| `PORT` | Server port (default `3001`) |

**Optional – oriented boxes (YOLO OBB + Gemini):** The OBB service runs **separately** (different repo or host). Deploy it elsewhere, then set `ANALYZE_PIPELINE=yolo-obb` and `YOLO_OBB_SERVICE_URL=<your OBB service URL>` in this app’s environment. The app will call that URL for detections; if it returns none, analysis falls back to full-image Gemini.

**Frontend** – optional: create `client/.env` and set `VITE_API_BASE_URL` if the API is on another origin. By default the Vite proxy forwards `/api` to the backend.

### 3. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run the script in `supabase/schema.sql` to create the `label_analyses` table and RLS policy.
3. In **Storage**, create a bucket (e.g. `label-images`) and make it **public** so the app can display stored images.

### 4. Run the app

From the project root:

```bash
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Server: [http://localhost:3001](http://localhost:3001)

## Usage

1. **Analyse** – On the home page, add one or more label images (upload or capture with camera). You can edit the extraction prompt, then run analysis. Each image is saved to history with its **filename** as the item name.
2. **History** – View past analyses. **Collapsed:** filename. **Expanded:** extracted text (left), image with bounding boxes (right; click to open in modal), extraction prompt (editable), and **Re-analyse** button. Delete one or delete all.

## Deploy on Render

Recommended setup on Render (single repo, one Render blueprint):

1. **API service (Node/Express)**
   - Root directory: `web-app/server`
   - Build command: `npm install`
   - Start command: `npm start`
   - Env vars: `GOOGLE_GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET_NAME`, `ANALYZE_PIPELINE=yolo-obb`, `YOLO_OBB_SERVICE_URL=<your yolo service URL>`

2. **Frontend static site (Vite)**
   - Root directory: `web-app/client`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   - Env var: `VITE_API_BASE_URL=<your API service URL>`

3. **YOLO OBB service (Python)**
   - Deploy from `yolo-obb-service` (see `../yolo-obb-service/RENDER_DEPLOY.md`)
   - Set `YOLO_OBB_WEIGHTS=best.pt` and other optional vars.

4. **Database migration**
   - Run `supabase/migrations/001_obb_metadata.sql` in Supabase SQL Editor so OBB detection count/fallback can be stored.

## Project layout

```
web-app/
├── server/                 # Express API
│   ├── lib/                # Gemini, Supabase, YOLO OBB client, compression
│   ├── routes/             # /api/analyze, /api/history
│   └── index.js
├── client/                 # React (Vite)
│   └── src/
│       ├── components/
│       ├── lib/            # API client, client-side compression
│       ├── pages/          # Analyse, History
│       └── App.jsx
├── supabase/
│   ├── schema.sql
│   └── migrations/        # 001_obb_metadata.sql for OBB columns
└── README.md
```

The **YOLO OBB service** is a separate app (different repo or deploy). This app calls it over HTTP when `ANALYZE_PIPELINE=yolo-obb` and `YOLO_OBB_SERVICE_URL` are set.
