# ViralAgent — Virality Prediction Service

FastAPI service that scores a short-form video's viral potential. The BViral
api-server downloads an uploaded video and POSTs it here; the response feeds the
**Virality Predictor** card in the dashboard.

This is **inference only** — it loads the pre-trained artifacts in this folder and
serves them. No training / notebook runs are involved.

## What it loads (already present, never retrained)

- `best_model.pkl` — trained XGBoost regressor (predicts `log_views`)
- `hook_pca.pkl`, `full_pca.pkl`, `text_pca.pkl` — fitted PCA transformers
- `model_meta.json` — the 476 feature names + target/model type
- `api.py` + `agentsteps/05_agent_inference.py` + `agentsteps/config.py` — serving code

At request time it also loads frozen feature encoders (CLIP `clip-vit-base-patch32`,
Whisper `base`, SentenceTransformer MiniLM) — auto-downloaded once from HuggingFace
and cached — plus one Groq LLM call per video.

## Prerequisites

- **Python 3.11**
- **ffmpeg** on PATH (Whisper/librosa need it): `winget install Gyan.FFmpeg`
- **GROQ_API_KEY** in the environment (LLM step contributes ~60 of the 476 features;
  it degrades gracefully if missing, but set it for accuracy)
- Optional **NVIDIA GPU**: inference auto-selects CUDA when a CUDA-enabled torch is
  installed. On a 4 GB card (e.g. GTX 1650) this fits because the caller runs one
  analysis at a time.

## Setup

```powershell
cd agents\ViralAgent
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# GPU build of torch for CUDA 12.x (skip for CPU-only):
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

pip install -r requirements_api.txt
```

## Run

```powershell
# from agents\ViralAgent, with the venv active
$env:GROQ_API_KEY = "gsk_...your_key..."
uvicorn api:app --host 127.0.0.1 --port 8000
```

The api-server reaches it via `VIRALITY_SERVICE_URL` (default `http://127.0.0.1:8000`).

## Endpoints

- `GET  /health`     — `{ "status": "ok", "model_type": "xgb" }` once the model is loaded
- `GET  /model-info` — model type, feature count (476), target column
- `POST /analyze`    — multipart `file` (video) + `title` + `platform` → full report
  (`predicted_views_estimate`, `viral_tier`, `shap_pushing_up/down`, `llm_analysis`,
  `hook_transcript`, `viral_score`)

### Quick smoke test

```powershell
curl -F "file=@sample.mp4" -F "title=my caption" -F "platform=tiktok" http://127.0.0.1:8000/analyze
```

A correct run logs `Using device: cuda` and builds a 476-wide feature vector. If you
ever see PCA being skipped, confirm the `*_pca.pkl` files are in this folder (api.py
points `config.PCA_DIR` here).

## Security note

CORS is currently `*` and intended for local development only. Before exposing this
service beyond localhost, restrict CORS and add a shared-secret header that the
api-server sends.
