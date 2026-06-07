import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Download, Loader2, Play, Sparkles, Wand2,
} from 'lucide-react';
import {
  getListVideosQueryKey,
  useApproveCaptions,
  useGenerateLtx,
  useListVideos,
  type Video,
} from '@workspace/api-client-react';
import { useAiJob } from '@/hooks/useAiJob';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { estimateLtxCostUsd } from '@/lib/ltx-pricing';
import { CaptionGeneratorCard, type CaptionPreview } from '@/components/ai-studio/CaptionGeneratorCard';
import { LtxGenerateConfirmModal } from '@/components/ai-studio/LtxGenerateConfirmModal';
import { VideoEnhancementCard } from '@/components/ai-studio/VideoEnhancementCard';
import { VideoUploadZone } from '@/components/ai-studio/VideoUploadZone';
import { ViralityPredictorCard } from '@/components/ai-studio/ViralityPredictorCard';
import { StyledSelect } from '@/components/ui/styled-select';

const STYLE_TEMPLATES = [
  'None',
  'Fast Paced Tech',
  'Aesthetic Vlog',
  'Listicle/Top 5',
  'Faceless Motivation',
  'Cinematic',
];

const RESOLUTION_OPTIONS = [
  { value: '1080x1920', label: '9:16 vertical 1080p (TikTok/Reels)' },
  { value: '1920x1080', label: '16:9 landscape 1080p' },
  { value: '1440x2560', label: '9:16 vertical 1440p (premium)' },
] as const;

type ResolutionOption = (typeof RESOLUTION_OPTIONS)[number]['value'];

export default function AiVideoStudio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videosQuery = useListVideos();
  const videos = videosQuery.data?.data ?? [];

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [captionPreview, setCaptionPreview] = useState<CaptionPreview | null>(null);

  const approveCaptionsMutation = useApproveCaptions({
    mutation: {
      onSuccess: (updatedVideo) => {
        setSelectedVideo(updatedVideo);
        setCaptionPreview(null);
        queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
        toast({
          title: 'Captions approved',
          description: 'Saved the captioned version. The original raw video is still recoverable.',
        });
      },
      onError: (error) => {
        toast({
          title: 'Approval failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    },
  });

  const [prompt, setPrompt] = useState('');
  const [styleTemplate, setStyleTemplate] = useState<string>('None');
  const [durationSec, setDurationSec] = useState(5);
  const [resolution, setResolution] = useState<ResolutionOption>('1080x1920');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ltxJobId, setLtxJobId] = useState<string | null>(null);

  const costEstimate = useMemo(
    () => estimateLtxCostUsd({ resolution, durationSec }),
    [resolution, durationSec],
  );

  const generateLtxMutation = useGenerateLtx({
    mutation: {
      onSuccess: (data) => {
        setLtxJobId(data.jobId);
        setConfirmOpen(false);
        toast({
          title: 'LTX generation queued',
          description: `Estimated cost: $${data.estimatedCostUsd.toFixed(3)}`,
        });
      },
      onError: (error) => {
        setConfirmOpen(false);
        const status = (error as { status?: number } | undefined)?.status;
        toast({
          title: status === 503
            ? 'LTX not configured'
            : status === 429
            ? 'Daily cap reached'
            : 'LTX generation failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    },
  });

  const ltxJobQuery = useAiJob(ltxJobId);
  const ltxJob = ltxJobQuery.data;

  // When LTX finishes, refresh the videos list so the new clip appears below.
  useEffect(() => {
    if (ltxJob?.status === 'done') {
      queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
    }
  }, [ltxJob?.status, queryClient]);

  const handleConfirmGenerate = () => {
    generateLtxMutation.mutate({
      data: {
        prompt,
        style: styleTemplate === 'None' ? undefined : styleTemplate,
        durationSec,
        resolution,
      },
    });
  };

  const isLtxWorking = generateLtxMutation.isPending
    || (ltxJob && (ltxJob.status === 'queued' || ltxJob.status === 'running'));

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="glass-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/12 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-display font-bold text-white">AI Studio</h2>
            <p className="truncate text-xs text-muted-foreground/55">
              Analyze, caption, enhance — or generate a clip from scratch with LTX.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        {/* LEFT: Upload + 3 tool cards */}
        <div className="w-full lg:w-[58%] flex flex-col gap-4 min-h-0">
          <VideoUploadZone
            selectedVideo={selectedVideo}
            onUploaded={(video) => {
              setCaptionPreview(null);
              setSelectedVideo(video);
            }}
            captionPreviewUrl={captionPreview?.url ?? null}
            isApprovingCaption={approveCaptionsMutation.isPending}
            onApproveCaption={() => {
              if (captionPreview) {
                approveCaptionsMutation.mutate({ jobId: captionPreview.jobId });
              }
            }}
            onDiscardCaption={() => setCaptionPreview(null)}
          />
          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
            <ViralityPredictorCard video={selectedVideo} />
            <CaptionGeneratorCard video={selectedVideo} onPreview={setCaptionPreview} />
            <VideoEnhancementCard video={selectedVideo} />
          </div>
        </div>

        {/* RIGHT: Generate From Scratch (LTX) */}
        <div className="w-full lg:w-[42%] glass-card p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-accent/15 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-primary/10 blur-[80px] rounded-full pointer-events-none" />

          <div className="mb-6 relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center border border-accent/10">
                <Wand2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">Generate From Scratch</h2>
                <p className="text-muted-foreground/60 text-xs">Text-to-Video via LTX Studio. Capped at {10}s per clip.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 flex-1 relative z-10">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. a tiny robot waving hello, cinematic, golden hour"
                className="input-field h-28 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Style Template</label>
                <StyledSelect
                  value={styleTemplate}
                  onValueChange={setStyleTemplate}
                  ariaLabel="Style template"
                  options={STYLE_TEMPLATES.map((style) => ({ value: style, label: style }))}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Resolution</label>
                <StyledSelect<ResolutionOption>
                  value={resolution}
                  onValueChange={setResolution}
                  ariaLabel="Resolution"
                  options={RESOLUTION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
            </div>

            <div>
              <label className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Duration</span>
                <span className="text-xs text-white/80 font-mono">{durationSec}s</span>
              </label>
              <input
                type="range"
                min={2}
                max={10}
                step={1}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground/70">Estimated cost</span>
              <span className="text-sm font-mono font-semibold text-white">
                ~${costEstimate.toFixed(3)} <span className="text-[10px] text-muted-foreground/50">· {durationSec}s · {resolution}</span>
              </span>
            </div>

            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!prompt || isLtxWorking}
              className="w-full py-3.5 mt-2 btn-accent flex items-center justify-center gap-2 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLtxWorking ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Generating with LTX...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate video</>
              )}
            </button>

            {ltxJob && ltxJob.status === 'failed' && (
              <div className="rounded-xl border border-red-500/15 bg-red-500/8 p-3 text-xs text-red-300">
                LTX generation failed{ltxJob.error ? `: ${ltxJob.error}` : '.'}
              </div>
            )}

            {ltxJob && ltxJob.status === 'done' && (
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/8 p-3 text-xs text-emerald-300 flex items-center justify-between">
                <span>Generation complete — added to your videos.</span>
                {ltxJob.resultUrl && (
                  <a href={ltxJob.resultUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-white/90 hover:text-white">
                    <Download className="h-3 w-3" /> Open
                  </a>
                )}
              </div>
            )}

            {/* Uploaded Videos grid (also surfaces LTX-generated clips) */}
            <div className="pt-4 mt-4 border-t border-white/[0.06]">
              <h3 className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-3">Uploaded Videos</h3>
              {videosQuery.isLoading && (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="aspect-[9/16] bg-white/[0.04] border border-white/[0.06] rounded-xl animate-pulse" />
                  ))}
                </div>
              )}
              {videosQuery.isError && (
                <div className="rounded-xl border border-red-500/15 bg-red-500/8 p-4">
                  <p className="text-sm font-semibold text-red-300">Unable to load videos</p>
                  <button onClick={() => videosQuery.refetch()} className="mt-3 text-xs font-semibold text-white/70 hover:text-white">
                    Retry
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {!videosQuery.isLoading && !videosQuery.isError && videos.slice(0, 4).map((video) => (
                  <div key={video.id} className="aspect-[9/16] bg-black/40 border border-white/[0.06] rounded-xl relative overflow-hidden group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-50" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                      <span className="text-[10px] text-white/70 font-medium">{video.status} · {video.id.slice(0, 8)}</span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-all duration-300 backdrop-blur-sm gap-2">
                      <button
                        onClick={() => {
                          setPreviewingId(video.id);
                          setSelectedVideo(video);
                          toast({
                            title: 'Selected for analysis',
                            description: `Video ${video.id.slice(0, 8)} is now active in the AI tools.`,
                          });
                        }}
                        className="p-2 bg-primary/80 rounded-full text-white hover:scale-110 transition-transform cursor-pointer"
                        aria-label="Select for AI tools"
                      >
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                      <a
                        href={video.originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-white/15 rounded-full text-white hover:bg-white/25 transition-colors cursor-pointer"
                        aria-label="Open video"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    {previewingId === video.id ? (
                      <div className="absolute left-3 top-3 rounded-full border border-primary/30 bg-primary/18 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                        Active
                      </div>
                    ) : null}
                  </div>
                ))}
                {!videosQuery.isLoading && !videosQuery.isError && videos.length === 0 && (
                  <div className="col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 text-center">
                    <p className="text-sm text-white/60">No uploaded videos yet.</p>
                    <p className="mt-1 text-xs text-muted-foreground/40">Upload footage to populate this panel from the API.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <LtxGenerateConfirmModal
        open={confirmOpen}
        prompt={prompt}
        durationSec={durationSec}
        resolution={resolution}
        estimatedCostUsd={costEstimate}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmGenerate}
        isPending={generateLtxMutation.isPending}
      />
    </div>
  );
}
