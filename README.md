# Sentix Pro — Vite + React + Tailwind Frontend

A minimal, production‑ready React frontend wired to your FastAPI backend (v6.1‑Pro).

## Quick start
1) Ensure your backend is running on `http://localhost:8001`.
2) Unzip this project, then:
```bash
cd sentix-frontend
npm i
npm run dev
```
3) Open the URL printed by Vite (usually http://localhost:5173).

If your backend runs elsewhere, edit `.env`:
```env
VITE_API_BASE=http://localhost:8001
```

## Features
- Single‑text analysis with rationale and visuals
- Model selector + on‑the‑fly ONNX registration
- Sentence‑level timeline
- Class probability bars
- Batch scoring (.csv/.xlsx) with stacked counts, consensus rate, and "top‑by‑confidence" model
- Interactions summary (group by topic/person/ext_id)
- Basic usage KPIs

## Notes
- Tailwind is preconfigured.
- Charts built with `recharts`.
- If you prefer a dev proxy instead of CORS, add to `vite.config.js`:
  ```js
  server: { proxy: { '/api': 'http://localhost:8001' } }
  ```
  Then set `VITE_API_BASE` to `http://localhost:5173/api` and adjust the backend CORS accordingly or keep it open.