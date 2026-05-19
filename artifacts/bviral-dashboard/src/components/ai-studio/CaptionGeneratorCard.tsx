import React, { useState } from 'react';
import { Captions, Download, Loader2 } from 'lucide-react';
import {
  useGenerateCaptions,
  type Video,
} from '@workspace/api-client-react';
import { useAiJob } from '@/hooks/useAiJob';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CaptionGeneratorCardProps {
  video: Video | null;
}

export function CaptionGeneratorCard({ video }: CaptionGeneratorCardProps) {
  const { toast } = useToast();
  const [jobId, setJobId] = useState<string | null>(null);

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
  const isWorking = generateMutation.isPending
    || (job && (job.status === 'queued' || job.status === 'running'));

  const statusLabel = !job
    ? null
    : job.status === 'queued' ? 'Queued'
    : job.status === 'running' ? 'Transcribing with Whisper...'
    : job.status === 'done' ? 'Done'
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

      <button
        onClick={() => video && generateMutation.mutate({ data: { videoId: video.id } })}
        disabled={!video || isWorking}
        className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isWorking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Captions className="h-4 w-4" />
        )}
        {isWorking ? 'Generating...' : 'Generate captions with Whisper'}
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
