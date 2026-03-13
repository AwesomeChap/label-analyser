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
cd label-analyser
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

## Deploy on Vercel

1. Push your code to GitHub and import the project on [Vercel](https://vercel.com). Use the **root** as the project directory.
2. **Build and output:** From `vercel.json`: build command `cd client && npm install && npm run build`, output directory `client/dist`, install command includes `cd server && npm install`.
3. **Environment variables** (Settings → Environment Variables): add `GOOGLE_GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET_NAME`. Optionally `GEMINI_MODEL`.
4. Deploy. The frontend is served from the root; the API is at `/api/analyze`, `/api/history`, `/api/health`, and `/api/history/:id/reanalyse`.

**Note:** Vercel has a request body size limit (e.g. 4.5 MB). Images are compressed on the client before upload.

## Project layout

```
label-analyser/
├── api/                    # Vercel serverless (catch-all + reanalyse route)
├── server/                 # Express API
│   ├── lib/                # Gemini, Supabase, compression
│   ├── routes/             # /api/analyze, /api/history
│   └── index.js
├── client/                 # React (Vite)
│   └── src/
│       ├── components/
│       ├── lib/            # API client, client-side compression
│       ├── pages/          # Analyse, History
│       └── App.jsx
├── supabase/
│   └── schema.sql
├── vercel.json
└── README.md
```
