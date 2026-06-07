# Caption Agent — Speech-to-Text + Burned Subtitles

FastAPI service that transcribes a short-form video and burns animated captions
into it. The BViral api-server downloads an uploaded video and POSTs it here; the
returned captioned video feeds the **Generate Captions** card in the dashboard
(preview → approve flow).

This is **inference only** — it does not use any `.pkl` files. The pipeline is:
ffmpeg extracts audio → [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
transcribes (word-level timestamps) → SRT/ASS subtitles are generated → ffmpeg
burns the ASS subtitles into the video.

## Prerequisites

- **Python 3.11**
- **ffmpeg** on PATH (audio extraction + subtitle burn): `winget install Gyan.FFmpeg`
- Optional **NVIDIA GPU**: faster-whisper (CTranslate2) auto-selects CUDA when a
  CUDA-capable torch is installed. On a 4 GB card (e.g. GTX 1650) the `small` and
  `medium` models fit; `large` may run out of VRAM, especially if ViralAgent is
  using the GPU at the same time.

## Setup

This agent shares the **same dependencies** as ViralAgent except for two extra
packages, so the simplest setup is to **reuse the ViralAgent venv** and avoid
re-downloading torch (~2.5 GB):

```powershell
cd agents\caption
# Install only the two packages ViralAgent's venv is missing:
& "..\ViralAgent\.venv\Scripts\python.exe" -m pip install faster-whisper aiofiles
```

Or create a dedicated venv (downloads torch again):

```powershell
cd agents\caption
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install fastapi uvicorn faster-whisper python-multipart aiofiles torch
```

## Run

Runs on **port 8001** so it doesn't collide with ViralAgent (port 8000) — both
agents can run side by side.

```powershell
# from agents\caption — reusing the ViralAgent venv:
& "..\ViralAgent\.venv\Scripts\python.exe" -m uvicorn api:app --host 0.0.0.0 --port 8001

# or, with a dedicated venv active:
uvicorn api:app --host 0.0.0.0 --port 8001
```

The api-server reaches it via `CAPTIONS_SERVICE_URL` (default `http://127.0.0.1:8001`).

The Whisper model for each size is downloaded **once** to the HuggingFace cache
(`~/.cache/huggingface/hub/models--Systran--faster-whisper-{size}`) and reused
afterwards — the first run of a new size can take a while on a slow connection.
Tip: add `--reload` while developing so edits to `api.py` auto-apply.

## Endpoints

- `GET  /health` — `{ "status": "ok", "gpu": true/false, "gpu_name": "..." }`
- `POST /transcribe` — multipart `file` (video) + form fields:
  `model_size` (tiny|base|small|medium|large), `words_per_flash`,
  `subtitle_style` (stroke|yellow|pill), `video_width`, `video_height`,
  `burn_subtitles`, `save_pickle`. Returns JSON with the transcript and
  `downloads.{srt,word_srt,ass,video,pkl}` paths.
- `POST /transcribe/json-only` — transcript JSON only (no subtitle files / video)
- `GET  /download/{folder}/{filename}` — fetch a generated file
- `DELETE /cleanup/{folder}` — delete a temp output folder

### Quick smoke test

```powershell
curl -F "file=@sample.mp4" -F "subtitle_style=pill" -F "model_size=small" http://127.0.0.1:8001/transcribe
```

A correct run logs `Added subtitle file ... (N styles, M events)`, an ffmpeg
encode, then `POST /transcribe 200 OK`.

## Notes

- Output files are written under `outputs/` (git-ignored). The api-server worker
  downloads the burned video then calls `/cleanup`, so temp folders don't pile up
  when driven from the app.
- CORS is `*` for local development only. Restrict it and add a shared-secret
  header before exposing this service beyond localhost.
