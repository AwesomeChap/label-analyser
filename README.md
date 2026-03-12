# Label Analyser

Web app to analyse labels on small boxes from images: extract **text only** (QR codes and barcodes ignored) using **OpenAI (GPT-4o)** and **Google Gemini**, then show bounding boxes on the image and the extracted text with spacing preserved.

## Stack

- **Frontend:** React (Vite), Tailwind CSS
- **Backend:** Node.js (Express)
- **APIs:** OpenAI, Google Gemini (vision)

## Models used

| Provider | Model ID | Description |
|----------|----------|-------------|
| **OpenAI** | `gpt-4o` | Multimodal (vision + text) model. Used for image understanding and structured JSON output (text extraction + bounding boxes). [OpenAI models](https://platform.openai.com/docs/models). |
| **Google** | `gemini-2.5-flash` (default) | Multimodal Gemini model. Same task: extract text from the image and return JSON with `textBlocks` and `fullText`. Overridable via `GEMINI_MODEL` in `server/.env`. [Gemini models](https://ai.google.dev/gemini-api/docs/models). |

Both models receive the uploaded image plus a prompt that asks for:
- Only visible label text (no QR codes or barcodes)
- Exact spacing and line breaks preserved
- Normalized bounding boxes `[x_min, y_min, x_max, y_max]` (0–1) for each text block
- A single JSON object: `{ "textBlocks": [...], "fullText": "..." }`

## Setup

1. **Install dependencies**

   ```bash
   npm run install:all
   ```

   Or manually:

   ```bash
   npm install && cd client && npm install && cd ../server && npm install
   ```

2. **API keys**

   In `server/.env` (create from `server/.env.example`):

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   GOOGLE_GEMINI_API_KEY=your_google_gemini_api_key_here
   ```

   Get keys from:
   - [OpenAI API](https://platform.openai.com/api-keys)
   - [Google AI Studio](https://aistudio.google.com/apikey) (Gemini)

3. **Run**

   From the project root:

   ```bash
   npm run dev
   ```

   This starts:
   - Backend: `http://localhost:3001`
   - Frontend: `http://localhost:5173` (proxies `/api` to the backend)

   Or run separately:

   ```bash
   npm run dev:server   # terminal 1
   npm run dev:client   # terminal 2
   ```

## Usage

1. Open `http://localhost:5173`.
2. Click **Choose image** and select a label image (e.g. boxes with text and QR codes).
3. Click **Analyse**.
4. For each provider (OpenAI and Gemini) you get:
   - The image with **bounding boxes** around extracted text.
   - The **extracted text** as in the image (spaces and line breaks preserved).

## Deploy on Vercel

1. Push the repo to GitHub (or connect your Git provider in Vercel).
2. In [Vercel](https://vercel.com), **New Project** → import this repo. Use the **root** as the project directory.
3. **Environment variables** (Project → Settings → Environment Variables): add
   - `OPENAI_API_KEY` — your OpenAI API key  
   - `GOOGLE_GEMINI_API_KEY` — your Google Gemini API key  
   - `GEMINI_MODEL` (optional) — e.g. `gemini-2.5-flash` (default)
4. Deploy. The app uses `vercel.json`: build runs `npm run build`, output is `client/dist`, and `/api/analyze` is served by a serverless function in `api/analyze.js`.

**Note:** Vercel has a request body size limit (e.g. 4.5 MB). Keep image uploads within that limit.

## Project layout

- `client/` — React + Vite + Tailwind
- `server/` — Express, `/api/analyze` (multipart image), calls OpenAI + Gemini in parallel (local dev)
- `api/analyze.js` — Vercel serverless handler for `/api/analyze` (uses `server/openai.js` and `server/gemini.js`)
