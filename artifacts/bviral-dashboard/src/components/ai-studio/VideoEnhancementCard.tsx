import React, { useState } from 'react';
import { Download, Loader2, Sparkles, UserRound, Wand2 } from 'lucide-react';
import {
  useEnhanceVideo,
  type Video,
} from '@workspace/api-client-react';
import { useAiJob } from '@/hooks/useAiJob';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VideoEnhancementCardProps {
  video: Video | null;
}

interface ToggleProps {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function Toggle({ label, description, icon: Icon, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
        checked
          ? 'border-primary/30 bg-primary/10'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]',
      )}
    >
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
        checked ? 'border-primary/25 bg-primary/15 text-primary' : 'border-white/[0.06] bg-white/[0.04] text-muted-foreground/55',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-white/85">{label}</div>
        <div className="text-[10px] text-muted-foreground/55">{description}</div>
      </div>
      <div className={cn(
        'mt-1 h-4 w-4 shrink-0 rounded border-2 transition',
        checked ? 'border-primary bg-primary' : 'border-white/15',
      )} />
    </button>
  );
}

export function VideoEnhancementCard({ video }: VideoEnhancementCardProps) {
  const { toast } = useToast();
  const [upscale, setUpscale] = useState(false);
  const [faceRestore, setFaceRestore] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const enhanceMutation = useEnhanceVideo({
    mutation: {
      onSuccess: (data) => setJobId(data.jobId),
      onError: (error) => {
        toast({
          title: 'Enhancement failed to start',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    },
  });

  const jobQuery = useAiJob(jobId);
  const job = jobQuery.data;
  const isWorking = enhanceMutation.isPending
    || (job && (job.status === 'queued' || job.status === 'running'));
  const canRun = Boolean(video) && (upscale || faceRestore) && !isWorking;

  const statusLabel = !job
    ? null
    : job.status === 'queued' ? 'Queued'
    : job.status === 'running' ? 'Processing frames...'
    : job.status === 'done' ? 'Done'
    : 'Failed';

  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/12 text-primary">
          <Wand2 className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-display font-bold text-white">AI Video Enhancement</h3>
          <p className="text-[11px] text-muted-foreground/55">Real-ESRGAN upscale + GFPGAN face restore.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Toggle
          label="4K Upscale"
          description="Real-ESRGAN super-resolution"
          icon={Sparkles}
          checked={upscale}
          onChange={setUpscale}
        />
        <Toggle
          label="Face Restore"
          description="GFPGAN facial detail recovery"
          icon={UserRound}
          checked={faceRestore}
          onChange={setFaceRestore}
        />
      </div>

      <button
        onClick={() => video && enhanceMutation.mutate({ data: { videoId: video.id, upscale, faceRestore } })}
        disabled={!canRun}
        className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {isWorking ? 'Enhancing...' : 'Run enhancement'}
      </button>

      {statusLabel && (
        <div className={cn(
          'rounded-xl border p-3 text-sm',
          job?.status === 'failed'
            ? 'border-red-500/15 bg-red-500/8 text-red-300'
            : job?.status === 'done'
            ? 'border-emerald-500/15 bg-emerald-500/8 text-emerald-300'
            : 'border-white/[0.06] bg-white/[0.02] text-white/75',
        )}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{statusLabel}</span>
            {job?.status === 'done' && job.resultUrl && (
              <a
                href={job.resultUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white"
              >
                <Download className="h-3 w-3" /> Download
              </a>
            )}
          </div>
          {job?.status === 'failed' && job.error && (
            <p className="mt-1 text-xs">{job.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
