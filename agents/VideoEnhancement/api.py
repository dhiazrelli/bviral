"""
FastAPI — AI Video Enhancement Pipeline
========================================
Wraps the Ultimate Edition Colab notebook as a REST API callable from Node.js.

Install:
    pip install fastapi uvicorn python-multipart aiofiles torch opencv-python-headless
    pip install basicsr realesrgan gfpgan piq lpips tqdm ffmpeg-python

Run:
    uvicorn api:app --host 0.0.0.0 --port 8001 --reload
"""

import os
import json
import uuid
import shutil
import pickle
import subprocess
import warnings
import tempfile
import time
from pathlib import Path
from multiprocessing import cpu_count
from fractions import Fraction
from typing import Literal, Optional

warnings.filterwarnings("ignore", category=UserWarning, module="torchvision.*")

import cv2
import numpy as np
import torch
import ffmpeg
import aiofiles
from tqdm import tqdm
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# ─────────────────────────────────────────────────────────────────────────────
# App & directories
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Video Enhancement API",
    description="Real-ESRGAN + GFPGAN + classical filters — callable from Node.js dashboard.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR  = Path("pipeline/uploads");   UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
WORK_DIR    = Path("pipeline/working");   WORK_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR  = Path("pipeline/outputs");   OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
WEIGHTS_DIR = Path("weights");            WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTS  = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
MAX_FILE_MB   = 500
USE_GPU       = torch.cuda.is_available()
DEVICE        = torch.device("cuda") if USE_GPU else torch.device("cpu")
NUM_CPU_CORES = cpu_count()
UPSCALE_RATIO = 4

# ─────────────────────────────────────────────────────────────────────────────
# Model loaders
# ─────────────────────────────────────────────────────────────────────────────
def load_realesrgan(scale: int = 4):
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet
    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                    num_block=23, num_grow_ch=32, scale=scale)
    weight = str(WEIGHTS_DIR / f"RealESRGAN_x{scale}plus.pth")
    return RealESRGANer(scale=scale, model_path=weight, model=model,
                        tile=512, tile_pad=10,
                        half=(DEVICE.type == "cuda"), device=DEVICE)

def load_gfpgan(upsampler=None):
    from gfpgan import GFPGANer
    return GFPGANer(
        model_path=str(WEIGHTS_DIR / "GFPGANv1.4.pth"),
        upscale=UPSCALE_RATIO, arch="clean",
        channel_multiplier=2, bg_upsampler=upsampler, device=DEVICE,
    )

# ─────────────────────────────────────────────────────────────────────────────
# Video helpers
# ─────────────────────────────────────────────────────────────────────────────
def get_video_fps(video_path: str) -> str:
    try:
        cmd = ["ffprobe", "-v", "error", "-select_streams", "v:0",
               "-show_entries", "stream=r_frame_rate",
               "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)]
        r = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return str(round(float(Fraction(r.stdout.strip())), 3))
    except Exception:
        return "30"

def preprocess_video(job: dict) -> dict:
    src  = job["path"]
    jid  = job["job_id"]
    wdir = WORK_DIR / jid
    wdir.mkdir(parents=True, exist_ok=True)

    probe = ffmpeg.probe(src)
    vs    = next(s for s in probe["streams"] if s["codec_type"] == "video")
    fps   = get_video_fps(src)
    meta  = {
        "width":    int(vs["width"]),
        "height":   int(vs["height"]),
        "fps":      float(fps),
        "duration": float(probe["format"].get("duration", 0)),
        "bitrate":  int(probe["format"].get("bit_rate", 0)) // 1000,
        "codec":    vs["codec_name"],
    }
    with open(wdir / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    frames_dir = wdir / "frames"
    frames_dir.mkdir(exist_ok=True)
    (ffmpeg.input(src)
     .output(str(frames_dir / "frame_%06d.png"))
     .run(quiet=True, overwrite_output=True))

    audio_path = str(wdir / "audio.aac")
    try:
        ffmpeg.input(src).output(audio_path, acodec="copy").run(quiet=True, overwrite_output=True)
    except ffmpeg.Error:
        audio_path = None

    frame_count = len(list(frames_dir.glob("*.png")))
    return {**job, "meta": meta, "fps": fps, "frames_dir": str(frames_dir),
            "audio_path": audio_path, "frame_count": frame_count, "work_dir": str(wdir)}

# ─────────────────────────────────────────────────────────────────────────────
# Quality analysis
# ─────────────────────────────────────────────────────────────────────────────
def estimate_blur(frame):
    return cv2.Laplacian(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()

def estimate_noise(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32)
    return float(np.abs(gray - cv2.GaussianBlur(gray, (5, 5), 0)).mean())

def detect_low_light(frame):
    return float(cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)[:, :, 2].mean()) < 60

def detect_faces(frame) -> bool:
    detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return len(detector.detectMultiScale(gray, 1.1, 4)) > 0

def analyze_quality(job: dict, sample_frames: int = 10) -> dict:
    frame_files = sorted(Path(job["frames_dir"]).glob("*.png"))
    step = max(1, len(frame_files) // sample_frames)
    sampled = frame_files[::step][:sample_frames]
    blurs, noises, low_lights, has_faces = [], [], [], []
    for fp in sampled:
        frame = cv2.imread(str(fp))
        if frame is None: continue
        blurs.append(estimate_blur(frame))
        noises.append(estimate_noise(frame))
        low_lights.append(detect_low_light(frame))
        has_faces.append(detect_faces(frame))
    quality = {
        "blur_score":       round(float(np.mean(blurs)), 2),
        "noise_score":      round(float(np.mean(noises)), 2),
        "low_light_pct":    round(sum(low_lights) / len(low_lights) * 100, 1),
        "faces_detected":   any(has_faces),
        "needs_denoise":    float(np.mean(noises)) > 3.0,
        "needs_deblur":     float(np.mean(blurs)) < 200.0,
        "needs_color_fix":  sum(low_lights) / len(low_lights) > 0.2,
        "needs_sr":         job["meta"]["width"] < 1080,
    }
    quality["recommended_filter"] = "denoise" if quality["needs_denoise"] else "balanced"
    return {**job, "quality": quality}

# ─────────────────────────────────────────────────────────────────────────────
# Classical filter stage
# ─────────────────────────────────────────────────────────────────────────────
def apply_filter(frame, mode: str = "balanced"):
    if mode == "artifact":
        return cv2.medianBlur(frame, ksize=3)
    elif mode == "denoise":
        return cv2.bilateralFilter(frame, d=9, sigmaColor=75, sigmaSpace=75)
    elif mode == "smooth":
        blur = cv2.GaussianBlur(frame, (5, 5), 0)
        return cv2.addWeighted(frame, 1.5, blur, -0.5, 0)
    elif mode == "balanced":
        clean = cv2.bilateralFilter(frame, d=7, sigmaColor=50, sigmaSpace=50)
        blur  = cv2.GaussianBlur(clean, (0, 0), 3)
        return cv2.addWeighted(clean, 1.4, blur, -0.4, 0)
    elif mode == "aggressive":
        s1   = cv2.medianBlur(frame, 3)
        s2   = cv2.bilateralFilter(s1, d=9, sigmaColor=75, sigmaSpace=75)
        blur = cv2.GaussianBlur(s2, (0, 0), 3)
        return cv2.addWeighted(s2, 1.5, blur, -0.5, 0)
    return frame

def run_filter_stage(job: dict, filter_mode: Optional[str] = None) -> dict:
    if filter_mode is None:
        filter_mode = job["quality"].get("recommended_filter", "balanced")
    frames_dir  = Path(job["frames_dir"])
    out_dir     = Path(job["work_dir"]) / "filtered_frames"
    out_dir.mkdir(exist_ok=True)
    for fp in sorted(frames_dir.glob("*.png")):
        frame = cv2.imread(str(fp))
        if frame is None: continue
        cv2.imwrite(str(out_dir / fp.name), apply_filter(frame, filter_mode))
    job["frames_dir"] = str(out_dir)
    return {**job, "filter_mode": filter_mode}

# ─────────────────────────────────────────────────────────────────────────────
# AI enhancement
# ─────────────────────────────────────────────────────────────────────────────
def run_enhancement_engine(job: dict, enhance_mode: str = "hd",
                            skip_sr: bool = False, skip_face: bool = False) -> dict:
    quality    = job["quality"]
    frames_dir = Path(job["frames_dir"])
    out_dir    = Path(job["work_dir"]) / "enhanced_frames"
    out_dir.mkdir(exist_ok=True)
    frame_files = sorted(frames_dir.glob("*.png"))

    run_sr   = (not skip_sr) and quality["needs_sr"] and enhance_mode != "fast"
    run_face = (not skip_face) and quality["faces_detected"]
    scale    = 4 if enhance_mode == "ultra" else 2

    if USE_GPU:
        upsampler    = load_realesrgan(scale) if run_sr else None
        face_enhance = load_gfpgan(upsampler) if run_face else None
        for fp in frame_files:
            img = cv2.imread(str(fp), cv2.IMREAD_UNCHANGED)
            if img is None: continue
            try:
                if upsampler:    img, _ = upsampler.enhance(img, outscale=UPSCALE_RATIO)
                if face_enhance: _, _, img = face_enhance.enhance(img, has_aligned=False,
                                             only_center_face=False, paste_back=True)
                cv2.imwrite(str(out_dir / fp.name), img)
            except Exception:
                shutil.copy2(str(fp), str(out_dir / fp.name))
    else:
        upsampler = load_realesrgan(scale) if run_sr else None
        for fp in frame_files:
            img = cv2.imread(str(fp))
            if img is None: continue
            if upsampler: img, _ = upsampler.enhance(img, outscale=UPSCALE_RATIO)
            cv2.imwrite(str(out_dir / fp.name), img)

    return {**job, "enhanced_frames_dir": str(out_dir),
            "enhance_mode": enhance_mode, "ran_gfpgan": run_face}

# ─────────────────────────────────────────────────────────────────────────────
# Post-processing (reassemble video)
# ─────────────────────────────────────────────────────────────────────────────
def post_process(job: dict, codec: str = "h264", target_res: str = "1080p") -> dict:
    CODEC_MAP      = {"h264": "libx264", "h265": "libx265", "av1": "libaom-av1"}
    RESOLUTION_MAP = {"720p": (1280, 720), "1080p": (1920, 1080), "4k": (3840, 2160)}

    enh_dir     = Path(job["enhanced_frames_dir"])
    frames_glob = str(enh_dir / "frame_%06d.png")
    if not list(enh_dir.glob("frame_??????.png")):
        frames_glob = str(enh_dir / "frame_%05d.png")

    audio_path = job.get("audio_path")
    out_path   = str(OUTPUT_DIR / f"{job['job_id']}_{target_res}_{codec}.mp4")
    w, h = RESOLUTION_MAP.get(target_res, (1920, 1080))
    vf   = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2"
    fps  = job.get("fps", "30")

    cmd = ["ffmpeg", "-y", "-framerate", str(fps), "-i", frames_glob]
    if audio_path and Path(audio_path).exists():
        cmd += ["-i", audio_path, "-map", "0:v:0", "-map", "1:a:0",
                "-c:a", "aac", "-b:a", "192k"]
    cmd += ["-c:v", CODEC_MAP[codec], "-crf", "18", "-preset", "fast",
            "-pix_fmt", "yuv420p", "-vf", vf, "-movflags", "+faststart", out_path]
    subprocess.run(cmd, capture_output=True, check=True)

    size_mb = Path(out_path).stat().st_size / (1024 ** 2)
    return {**job, "output_path": out_path, "output_res": target_res,
            "codec": codec, "output_size_mb": round(size_mb, 2)}

# ─────────────────────────────────────────────────────────────────────────────
# Quality metrics
# ─────────────────────────────────────────────────────────────────────────────
def frame_to_tensor(frame):
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    return torch.from_numpy(rgb).permute(2, 0, 1).unsqueeze(0)

def evaluate_quality(job: dict, sample_n: int = 10) -> dict:
    try:
        import piq
    except ImportError:
        return {**job, "metrics": {}}

    orig_files = sorted(Path(job["frames_dir"]).glob("*.png"))
    enh_files  = sorted(Path(job["enhanced_frames_dir"]).glob("*.png"))
    step = max(1, len(orig_files) // sample_n)
    all_m, enh_frames = [], []
    for i in range(0, len(orig_files), step):
        o = cv2.imread(str(orig_files[i]))
        e = cv2.imread(str(enh_files[min(i, len(enh_files) - 1)]))
        if o is None or e is None: continue
        h = min(o.shape[0], e.shape[0]); w = min(o.shape[1], e.shape[1])
        ot = frame_to_tensor(cv2.resize(o, (w, h)))
        et = frame_to_tensor(cv2.resize(e, (w, h)))
        m = {}
        try: m["psnr"] = round(piq.psnr(ot, et, data_range=1.).item(), 2)
        except: pass
        try: m["ssim"] = round(piq.ssim(ot, et, data_range=1.).item(), 4)
        except: pass
        all_m.append(m); enh_frames.append(e)
    keys = all_m[0].keys() if all_m else []
    summary = {k: round(float(np.mean([m[k] for m in all_m if k in m])), 4) for k in keys}
    if len(enh_frames) > 1:
        diffs = [np.abs(enh_frames[i].astype(float) - enh_frames[i-1].astype(float)).mean()
                 for i in range(1, len(enh_frames))]
        summary["flicker_score"] = round(float(np.mean(diffs)), 4)
    return {**job, "metrics": summary}

# ─────────────────────────────────────────────────────────────────────────────
# Manifest
# ─────────────────────────────────────────────────────────────────────────────
def prepare_manifest(job: dict) -> dict:
    manifest = {
        "job_id":       job["job_id"],
        "status":       "ready",
        "profiles":     {
            "mobile":  {"res": "720p",  "bitrate": "2M",  "codec": "h264"},
            "tablet":  {"res": "1080p", "bitrate": "4M",  "codec": "h264"},
            "desktop": {"res": "1080p", "bitrate": "8M",  "codec": "h265"},
            "tv_4k":   {"res": "4k",    "bitrate": "20M", "codec": "av1"},
        },
        "metrics":      job.get("metrics", {}),
        "enhance_mode": job.get("enhance_mode"),
        "filter_mode":  job.get("filter_mode"),
        "ran_gfpgan":   job.get("ran_gfpgan", False),
        "original_res": f"{job['meta']['width']}x{job['meta']['height']}",
        "output_res":   job.get("output_res"),
        "output_size_mb": job.get("output_size_mb"),
    }
    path = OUTPUT_DIR / f"{job['job_id']}_manifest.json"
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
    return {**job, "manifest_path": str(path), "manifest": manifest}

# ─────────────────────────────────────────────────────────────────────────────
# PKL save/load helpers
# ─────────────────────────────────────────────────────────────────────────────
def save_job_pkl(job: dict) -> str:
    pkl_path = str(OUTPUT_DIR / f"{job['job_id']}_job.pkl")
    payload = {k: v for k, v in job.items()
               if k not in ("manifest",)}   # manifest is already a json file
    with open(pkl_path, "wb") as f:
        pickle.dump(payload, f)
    return pkl_path

def load_job_pkl(pkl_path: str) -> dict:
    with open(pkl_path, "rb") as f:
        return pickle.load(f)

# ─────────────────────────────────────────────────────────────────────────────
# Full pipeline
# ─────────────────────────────────────────────────────────────────────────────
def run_full_pipeline(
    video_path: str,
    job_id: str,
    enhance_mode: str = "hd",
    filter_mode: Optional[str] = None,
    codec: str = "h264",
    target_res: str = "1080p",
    skip_sr: bool = False,
    skip_face: bool = False,
    save_pickle: bool = True,
) -> dict:
    job = {
        "job_id":  job_id,
        "path":    video_path,
        "size_mb": round(Path(video_path).stat().st_size / (1024 ** 2), 2),
    }
    job = preprocess_video(job)
    job = analyze_quality(job)
    job = run_filter_stage(job, filter_mode)
    job = run_enhancement_engine(job, enhance_mode=enhance_mode,
                                 skip_sr=skip_sr, skip_face=skip_face)
    job = post_process(job, codec=codec, target_res=target_res)
    job = evaluate_quality(job)
    job = prepare_manifest(job)

    pkl_url = None
    if save_pickle:
        pkl_path = save_job_pkl(job)
        pkl_url  = f"/download/{job_id}/{Path(pkl_path).name}"

    return {**job, "pkl_url": pkl_url}

# ─────────────────────────────────────────────────────────────────────────────
# Cleanup helper
# ─────────────────────────────────────────────────────────────────────────────
def cleanup_job(job_id: str):
    work = WORK_DIR / job_id
    upload_files = list(UPLOAD_DIR.glob(f"{job_id}*"))
    if work.exists():
        shutil.rmtree(work)
    for f in upload_files:
        f.unlink(missing_ok=True)


# ═════════════════════════════════════════════════════════════════════════════
# Routes
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "gpu":    USE_GPU,
        "gpu_name": torch.cuda.get_device_name(0) if USE_GPU else None,
        "cpu_cores": NUM_CPU_CORES,
    }


@app.post("/enhance", tags=["Pipeline"])
async def enhance_video(
    background_tasks: BackgroundTasks,
    file:         UploadFile = File(..., description="Video file (mp4, mov, avi, webm, mkv)"),
    enhance_mode: Literal["fast", "hd", "ultra"] = Form("hd"),
    filter_mode:  Optional[Literal["balanced", "artifact", "denoise", "smooth", "aggressive"]] = Form(None),
    codec:        Literal["h264", "h265", "av1"]  = Form("h264"),
    target_res:   Literal["720p", "1080p", "4k"]  = Form("1080p"),
    skip_sr:      bool = Form(False),
    skip_face:    bool = Form(False),
    save_pickle:  bool = Form(True),
):
    """
    Full AI enhancement pipeline.
    Returns JSON with quality report, metrics, and download URLs.

    Node.js example:
        const form = new FormData();
        form.append('file', fs.createReadStream('video.mp4'));
        form.append('enhance_mode', 'hd');
        form.append('target_res', '1080p');
        form.append('save_pickle', 'true');
        const res = await axios.post('http://localhost:8001/enhance', form, {
          headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity
        });
        console.log(res.data.downloads);
    """
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTS:
        raise HTTPException(400, f"Unsupported file type: {suffix}")

    job_id    = str(uuid.uuid4())[:8]
    save_path = UPLOAD_DIR / f"{job_id}{suffix}"

    async with aiofiles.open(save_path, "wb") as out:
        content = await file.read()
        if len(content) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(413, f"File exceeds {MAX_FILE_MB} MB limit")
        await out.write(content)

    try:
        t0  = time.time()
        job = run_full_pipeline(
            video_path=str(save_path),
            job_id=job_id,
            enhance_mode=enhance_mode,
            filter_mode=filter_mode,
            codec=codec,
            target_res=target_res,
            skip_sr=skip_sr,
            skip_face=skip_face,
            save_pickle=save_pickle,
        )
        elapsed = round(time.time() - t0, 1)

        return JSONResponse({
            "status":       "success",
            "job_id":       job_id,
            "elapsed_s":    elapsed,
            "original":     {"width": job["meta"]["width"], "height": job["meta"]["height"],
                             "fps": job["meta"]["fps"], "duration_s": job["meta"]["duration"]},
            "quality":      job["quality"],
            "metrics":      job.get("metrics", {}),
            "enhance_mode": enhance_mode,
            "filter_mode":  job.get("filter_mode"),
            "ran_gfpgan":   job.get("ran_gfpgan", False),
            "downloads": {
                "video":    f"/download/{job_id}/{Path(job['output_path']).name}",
                "manifest": f"/download/{job_id}/{Path(job['manifest_path']).name}",
                "pkl":      job.get("pkl_url"),
            },
        })

    except subprocess.CalledProcessError as e:
        raise HTTPException(500, f"FFmpeg error: {e.stderr.decode()[:500] if e.stderr else str(e)}")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/analyze", tags=["Analysis"])
async def analyze_only(
    file: UploadFile = File(..., description="Video to analyze (no enhancement)"),
):
    """
    Returns only the quality report (blur, noise, faces, low-light).
    Fast — no AI models loaded.
    """
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTS:
        raise HTTPException(400, f"Unsupported: {suffix}")

    job_id    = str(uuid.uuid4())[:8]
    save_path = UPLOAD_DIR / f"{job_id}{suffix}"
    async with aiofiles.open(save_path, "wb") as out:
        await out.write(await file.read())

    try:
        job = {"job_id": job_id, "path": str(save_path),
               "size_mb": round(save_path.stat().st_size / (1024 ** 2), 2)}
        job = preprocess_video(job)
        job = analyze_quality(job)
        return {"job_id": job_id, "meta": job["meta"], "quality": job["quality"]}
    finally:
        shutil.rmtree(WORK_DIR / job_id, ignore_errors=True)
        save_path.unlink(missing_ok=True)


@app.get("/job/{job_id}", tags=["Jobs"])
def get_job(job_id: str):
    """Load a previously saved job from its .pkl file."""
    pkl_path = OUTPUT_DIR / f"{job_id}_job.pkl"
    if not pkl_path.exists():
        raise HTTPException(404, f"No job found for id: {job_id}")
    job = load_job_pkl(str(pkl_path))
    return {
        "job_id":       job["job_id"],
        "meta":         job.get("meta"),
        "quality":      job.get("quality"),
        "metrics":      job.get("metrics", {}),
        "enhance_mode": job.get("enhance_mode"),
        "filter_mode":  job.get("filter_mode"),
        "ran_gfpgan":   job.get("ran_gfpgan"),
        "output_path":  job.get("output_path"),
        "output_res":   job.get("output_res"),
        "output_size_mb": job.get("output_size_mb"),
    }


@app.get("/download/{job_id}/{filename}", tags=["Files"])
def download_file(job_id: str, filename: str):
    """Download any generated file (video, manifest, pkl)."""
    # Check outputs directory first
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(str(file_path), filename=filename)


@app.delete("/job/{job_id}", tags=["Jobs"])
def delete_job(job_id: str):
    """Delete all working files for a job (call after downloading outputs)."""
    cleanup_job(job_id)
    for f in OUTPUT_DIR.glob(f"{job_id}*"):
        f.unlink(missing_ok=True)
    return {"status": "deleted", "job_id": job_id}
