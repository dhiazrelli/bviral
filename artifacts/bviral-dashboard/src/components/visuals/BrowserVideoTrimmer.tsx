import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Download,
  Pause,
  Play,
  RefreshCcw,
  Scissors,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight, self-contained HTML5 video trimmer.
 *
 * Why this exists: the BVIRAL Video Editor (`artifacts/openvideo`) is a
 * separate Next.js app that may or may not be running on a developer's
 * machine. This component is the in-dashboard fallback so users can do the
 * #1 most common edit (trim a clip) without spinning up the Next.js editor
 * or hitting any backend.
 *
 * Capabilities:
 *   - Pick a file from disk (mp4 / mov / webm).
 *   - Scrubbable preview with start/end markers and a duration readout.
 *   - Hardware-accelerated playback via the native <video> element, so it
 *     stays smooth on long clips.
 *   - "Download trimmed" uses MediaRecorder to capture the chosen segment
 *     to webm. Falls back to "download original" if MediaRecorder isn't
 *     available (e.g. Safari before 14.1).
 *
 * No external dependencies, no network calls — runs entirely in the
 * browser tab and respects whatever permissions the user already has.
 */

interface BrowserVideoTrimmerProps {
  className?: string;
}

interface TrimRange {
  start: number;
  end: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatTimecode(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.0";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
}

function pickRecorderMime(): string | null {
  if (typeof window === "undefined") return null;
  const Recorder = (window as unknown as { MediaRecorder?: { isTypeSupported?: (type: string) => boolean } }).MediaRecorder;
  if (!Recorder?.isTypeSupported) return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((mime) => Recorder.isTypeSupported!(mime)) ?? null;
}

export function BrowserVideoTrimmer({ className }: BrowserVideoTrimmerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trim, setTrim] = useState<TrimRange>({ start: 0, end: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const recorderMime = useMemo(() => pickRecorderMime(), []);
  const trimDuration = Math.max(0, trim.end - trim.start);
  const trimRatio = duration > 0 ? trimDuration / duration : 0;

  // Keep <video> playback inside the trim window.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      if (trim.end > 0 && time >= trim.end) {
        video.pause();
        video.currentTime = trim.start;
        setIsPlaying(false);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [trim.end, trim.start]);

  // Revoke object URLs when we swap files or unmount.
  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    };
  }, [sourceUrl, exportedUrl]);

  const handleFileSelected = useCallback((file: File) => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    const url = URL.createObjectURL(file);
    setSourceFile(file);
    setSourceUrl(url);
    setExportedUrl(null);
    setExportError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setTrim({ start: 0, end: 0 });
  }, [exportedUrl, sourceUrl]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const total = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(total);
    setTrim({ start: 0, end: total });
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !sourceUrl) return;
    if (video.paused) {
      if (video.currentTime < trim.start || video.currentTime >= trim.end) {
        video.currentTime = trim.start;
      }
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = clamp(time, 0, duration);
    video.currentTime = next;
    setCurrentTime(next);
  };

  const handleStartChange = (value: number) => {
    setTrim((current) => {
      const start = clamp(value, 0, current.end - 0.1);
      if (videoRef.current && videoRef.current.currentTime < start) {
        videoRef.current.currentTime = start;
      }
      return { start, end: current.end };
    });
  };

  const handleEndChange = (value: number) => {
    setTrim((current) => {
      const end = clamp(value, current.start + 0.1, duration || value);
      if (videoRef.current && videoRef.current.currentTime > end) {
        videoRef.current.currentTime = end;
      }
      return { start: current.start, end };
    });
  };

  const exportTrimmedSegment = async () => {
    if (!sourceFile || !sourceUrl || !videoRef.current) return;
    setExportError(null);
    setIsExporting(true);
    setExportedUrl(null);

    try {
      if (!recorderMime) {
        throw new Error("Your browser doesn't support MediaRecorder. Use 'Download original' instead.");
      }

      const video = videoRef.current;
      const captureSource = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
      };
      const stream = captureSource.captureStream?.();
      if (!stream) {
        throw new Error("This browser can't capture a stream from <video>. Try Chrome or Firefox.");
      }

      const recorder = new MediaRecorder(stream, { mimeType: recorderMime });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorderMime }));
        recorder.onerror = (event) => reject((event as ErrorEvent).error ?? new Error("MediaRecorder failed."));
      });

      video.muted = true;
      video.currentTime = trim.start;
      await new Promise<void>((resolve) => {
        const handler = () => {
          video.removeEventListener("seeked", handler);
          resolve();
        };
        video.addEventListener("seeked", handler);
      });

      recorder.start(100);
      await video.play();

      await new Promise<void>((resolve) => {
        const tick = () => {
          if (video.currentTime >= trim.end - 0.01) {
            video.pause();
            resolve();
          } else {
            requestAnimationFrame(tick);
          }
        };
        tick();
      });

      recorder.stop();
      const blob = await finished;
      setExportedUrl(URL.createObjectURL(blob));
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Failed to export the trimmed clip.",
      );
    } finally {
      setIsExporting(false);
      setIsPlaying(false);
      if (videoRef.current) videoRef.current.muted = isMuted;
    }
  };

  return (
    <div
      className={cn(
        "glass-card flex flex-col gap-4 p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/12 text-primary">
            <Scissors className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-white">Quick Trim</h3>
            <p className="text-[11px] text-muted-foreground/55">
              Browser-only fallback editor. No upload required.
            </p>
          </div>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-white/75 hover:bg-white/[0.07]"
        >
          <Upload className="h-3.5 w-3.5" />
          {sourceFile ? "Replace" : "Pick file"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="video/mp4,video/quicktime,video/webm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFileSelected(file);
            event.target.value = "";
          }}
        />
      </div>

      <div className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.06] bg-black">
        {sourceUrl ? (
          <video
            ref={videoRef}
            src={sourceUrl}
            className="h-full w-full"
            playsInline
            muted={isMuted}
            onLoadedMetadata={handleLoadedMetadata}
            onClick={togglePlay}
          />
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/55 transition hover:text-white"
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm font-semibold">Drop a video to start trimming</span>
            <span className="text-[11px] text-muted-foreground/50">MP4 / MOV / WebM, processed locally</span>
          </button>
        )}

        {sourceUrl && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/45 px-2 py-1.5 backdrop-blur">
            <button
              onClick={togglePlay}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
            </button>
            <div className="font-mono text-[11px] text-white/75">
              {formatTimecode(currentTime)} / {formatTimecode(duration)}
            </div>
            <button
              onClick={() => setIsMuted((current) => !current)}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white/85 hover:bg-white/20"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            <span>Scrubber</span>
            <span className="font-mono normal-case tracking-normal text-white/55">{formatTimecode(currentTime)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.05}
            value={currentTime}
            disabled={!sourceUrl}
            onChange={(event) => seekTo(Number.parseFloat(event.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
              <span>Trim start</span>
              <span className="font-mono normal-case tracking-normal text-white/55">{formatTimecode(trim.start)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.05}
              value={trim.start}
              disabled={!sourceUrl}
              onChange={(event) => handleStartChange(Number.parseFloat(event.target.value))}
              className="w-full accent-emerald-400"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
              <span>Trim end</span>
              <span className="font-mono normal-case tracking-normal text-white/55">{formatTimecode(trim.end)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.05}
              value={trim.end}
              disabled={!sourceUrl}
              onChange={(event) => handleEndChange(Number.parseFloat(event.target.value))}
              className="w-full accent-rose-400"
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-muted-foreground/65">
          Selection:&nbsp;
          <span className="font-mono text-white/80">{formatTimecode(trimDuration)}</span>
          &nbsp;·&nbsp;{Math.round(trimRatio * 100)}% of clip
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={exportTrimmedSegment}
          disabled={!sourceUrl || isExporting || trimDuration < 0.1}
          className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isExporting
            ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
            : <Scissors className="h-3.5 w-3.5" />}
          {isExporting ? "Recording…" : "Export trimmed (webm)"}
        </button>
        {exportedUrl && (
          <a
            href={exportedUrl}
            download={(sourceFile?.name?.replace(/\.[^.]+$/, "") ?? "trimmed") + "-trimmed.webm"}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            Download clip
          </a>
        )}
        {sourceFile && (
          <a
            href={sourceUrl ?? "#"}
            download={sourceFile.name}
            className="text-[11px] text-muted-foreground/55 hover:text-white/70 underline-offset-2 hover:underline"
          >
            or download original
          </a>
        )}
      </div>

      {exportError && (
        <p className="rounded-md border border-red-500/15 bg-red-500/8 px-3 py-2 text-[11px] text-red-300">
          {exportError}
        </p>
      )}

      {!recorderMime && (
        <p className="text-[10px] text-muted-foreground/45">
          Note: this browser doesn't support webm MediaRecorder. The "Export
          trimmed" action won't work, but you can still download the original.
        </p>
      )}
    </div>
  );
}

export default BrowserVideoTrimmer;
