# AI Video Enhancement Pipeline

Real-ESRGAN + GFPGAN + classical filters for video upscaling and quality enhancement.

## Setup

### 1. Clone & configure secrets
```bash
cp ../.env.example ../.env
# Edit .env with your actual API keys
```

### 2. Run in Google Colab
Open `ai_video_enhancement_quality.ipynb` in Colab. Before running Stage 7, add your secrets via **Colab Secrets** (🔑 icon in sidebar):
- `REPLICATE_API_TOKEN`
- `DEEPAI_API_KEY`

The notebook reads them automatically with `os.environ.get(...)`.

### 3. Run locally
```bash
pip install python-dotenv
```
Add at the top of your local run:
```python
from dotenv import load_dotenv
load_dotenv()
```

## Pipeline Stages
| Stage | Description |
|-------|-------------|
| 0 | Install dependencies + download model weights |
| 1 | Global config & hardware detection (GPU/CPU) |
| 2 | Upload single file or batch directory |
| 3 | Video preprocessor — extract frames + audio |
| 4 | Quality analyzer — blur, noise, face detection |
| 5 | Classical filter enhancement |
| 6 | AI enhancement — Real-ESRGAN + GFPGAN |
| 7 | External API fallbacks (Replicate, DeepAI) |
| 8 | Post-processing — reassemble + encode |
| 10 | Before/after preview |
| 11 | Quality metrics — PSNR, SSIM, LPIPS |
| 12 | Publish manifest |

## API Keys (Stage 7 — optional)
| Service | Where to get | Free tier |
|---------|-------------|-----------|
| Replicate | replicate.com/account | $1 credit |
| DeepAI | deepai.org/dashboard | 100 calls/day |

## Notes
- Never commit `.env` to git (already in `.gitignore`)
- Model weights (~200MB) download automatically to `weights/` on first run
- GPU auto-detected; falls back to parallel CPU mode
