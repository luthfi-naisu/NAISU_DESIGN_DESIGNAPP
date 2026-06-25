# Design App

Local-first media processing web app: YouTube → GIF, Shutterstock stock assets, AI video generation, and image upscaling.

## Architecture

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn UI, TanStack Query
- **Backend:** Python 3.11+, FastAPI, Uvicorn

## Prerequisites

- Python 3.11+
- Node.js 18+
- FFmpeg (must be on `PATH`)
- Optional: `rembg[gpu]`, `gifski`, ComfyUI on `localhost:8188`

## Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### Run both

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

Open http://localhost:3000

## Push to GitHub

Repository: [NAISU_DESIGN_DESIGNAPP](https://github.com/luthfi-naisu/NAISU_DESIGN_DESIGNAPP)

```bash
# Pastikan Git terinstall (macOS: xcode-select --install)
./scripts/push-to-github.sh
```

Atau manual:

```bash
git init -b main
git remote add origin https://github.com/luthfi-naisu/NAISU_DESIGN_DESIGNAPP.git
git add -A
git commit -m "Initial commit: Design App web platform"
git push -u origin main
```

**Jangan commit** file `.env` / `.env.local` — sudah ada di `.gitignore`.

## Environment Variables

See `backend/.env.example` for all backend keys:

- `SHUTTERSTOCK_CLIENT_ID`, `SHUTTERSTOCK_CLIENT_SECRET`, `SHUTTERSTOCK_API_TOKEN`, `SHUTTERSTOCK_SUBSCRIPTION_ID`
- `SILICONFLOW_API_KEY`
- `REPLICATE_API_TOKEN`

Frontend: `NEXT_PUBLIC_API_URL=http://localhost:8000`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | System health check |
| POST | `/api/v1/pipeline/youtube-to-gif` | YouTube segment → GIF |
| POST | `/api/v1/pipeline/mp4-to-gif` | Local MP4 → GIF |
| GET | `/api/v1/jobs/{id}` | Job status |
| GET | `/api/v1/files/{id}/output.gif` | Download GIF |
| GET | `/api/v1/assets/search` | Shutterstock search |
| POST | `/api/v1/assets/license` | License & download video |
| POST | `/api/v1/assets/generate-video` | SiliconFlow AI video |
| POST | `/api/v1/ai/upscale` | Replicate upscale |
