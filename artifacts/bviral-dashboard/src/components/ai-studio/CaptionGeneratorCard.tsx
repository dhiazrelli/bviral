import React, { useEffect, useRef, useState } from 'react';
import { Captions, Loader2, RefreshCcw } from 'lucide-react';
import {
  useGenerateCaptions,
  type Video,
} from '@workspace/api-client-react';
import { useAiJob } from '@/hooks/useAiJob';
import { useToast } from '@/hooks/use-toast';
import { StyledSelect } from '@/components/ui/styled-select';
import { cn } from '@/lib/utils';

export interface CaptionPreview {
  url: string;
  jobId: string;
}

interface CaptionGeneratorCardProps {
  video: Video | null;
  /** Lifts the captioned preview up so the studio player can show it. */
  onPreview: (preview: CaptionPreview | null) => void;
}

type CaptionStyle = 'stroke' | 'yellow' | 'pill';
type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

const STYLE_OPTIONS: ReadonlyArray<{ value: CaptionStyle; label: string }> = [
  { value: 'pill', label: 'Pill (rounded bg)' },
  { value: 'stroke', label: 'Stroke (outline)' },
  { value: 'yellow', label: 'Yellow highlight' },
];

const WORDS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '1', label: '1 word' },
  { value: '2', label: '2 words' },
  { value: '3', label: '3 words' },
  { value: '4', label: '4 words' },
];

const MODEL_OPTIONS: ReadonlyArray<{ value: WhisperModel; label: string }> = [
  { value: 'tiny', label: 'Tiny (fastest)' },
  { value: 'base', label: 'Base' },
  { value: 'small', label: 'Small (balanced)' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large (most accurate)' },
];

export function CaptionGeneratorCard({ video, onPreview }: CaptionGeneratorCardProps) {
  const { toast } = useToast();
  const [jobId, setJobId] = useState<string | null>(null);
  const [style, setStyle] = useState<CaptionStyle>('pill');
  const [wordsPerFlash, setWordsPerFlash] = useState('2');
  const [modelSize, setModelSize] = useState<WhisperModel>('small');
  // Guards against re-notifying the parent on every poll once the job is done.
  const reportedJobId = useRef<string | null>(null);

  const generateMutation = useGenerateCaptions({
    mutation: {
      onSuccess: (data) => {
        setJobId(data.jobId);
      },
      onError: (error) => {
        toast({
          title: 'Caption job failed to start',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    },
  });

  const jobQuery = useAiJob(jobId);
  const job = jobQuery.data;

  // Reset everything when the selected video changes.
  useEffect(() => {
    setJobId(null);
    reportedJobId.current = null;
    onPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  // Lift the preview up once the job finishes successfully.
  useEffect(() => {
    if (
      job?.status === 'done'
      && job.resultUrl
      && jobId
      && reportedJobId.current !== jobId
    ) {
      reportedJobId.current = jobId;
      onPreview({ url: job.resultUrl, jobId });
      toast({
        title: 'Captions ready',
        description: 'Review the captioned preview in the player above, then approve or discard.',
      });
    }
  }, [job?.status, job?.resultUrl, jobId, onPreview, toast]);

  const isWorking = generateMutation.isPending
    || (job && (job.status === 'queued' || job.status === 'running'));

  const handleGenerate = (force = false) => {
    if (!video) return;
    reportedJobId.current = null;
    onPreview(null);
    generateMutation.mutate({
      data: {
        videoId: video.id,
        style,
        wordsPerFlash: Number(wordsPerFlash),
        modelSize,
        force,
      },
    });
  };

  const statusLabel = !job
    ? null
    : job.status === 'queued' ? 'Queued'
    : job.status === 'running' ? 'Transcribing with Whisper + burning subtitles...'
    : job.status === 'done' ? 'Preview ready — review it in the player above'
    : 'Failed';

  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/12 text-primary">
          <Captions className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-display font-bold text-white">Generate Captions</h3>
          <p className="text-[11px] text-muted-foreground/55">Whisper transcription + burned-in subtitles.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.14em] mb-1.5">Style</label>
          <StyledSelect<CaptionStyle>
            value={style}
            onValueChange={setStyle}
            ariaLabel="Caption style"
            options={STYLE_OPTIONS}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.14em] mb-1.5">Words / flash</label>
          <StyledSelect
            value={wordsPerFlash}
            onValueChange={setWordsPerFlash}
            ariaLabel="Words per flash"
            options={WORDS_OPTIONS}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.14em] mb-1.5">Model</label>
          <StyledSelect<WhisperModel>
            value={modelSize}
            onValueChange={setModelSize}
            ariaLabel="Whisper model size"
            options={MODEL_OPTIONS}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleGenerate(false)}
          disabled={!video || Boolean(isWorking)}
          className="btn-primary flex flex-1 items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isWorking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Captions className="h-4 w-4" />
          )}
          {isWorking ? 'Generating...' : 'Generate captions with Whisper'}
        </button>
        <button
          onClick={() => handleGenerate(true)}
          disabled={!video || Boolean(isWorking)}
          title="Ignore the cached result and re-run the caption pipeline"
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-[11px] font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCcw className={cn('h-3.5 w-3.5', isWorking && 'animate-spin')} />
          Regenerate
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/45">
        Results are cached per video + settings — generating again is instant unless you change a setting or hit Regenerate.
      </p>

      {statusLabel && (
        <div className={cn(
          'rounded-xl border p-3 text-sm',
          job?.status === 'failed'
            ? 'border-red-500/15 bg-red-500/8 text-red-300'
            : job?.status === 'done'
            ? 'border-emerald-500/15 bg-emerald-500/8 text-emerald-300'
            : 'border-white/[0.06] bg-white/[0.02] text-white/75',
        )}>
          <span className="text-xs font-semibold">{statusLabel}</span>
          {job?.status === 'failed' && job.error && (
            <p className="mt-1 text-xs">{job.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
