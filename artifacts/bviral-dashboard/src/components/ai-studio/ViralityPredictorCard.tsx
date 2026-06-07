import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Quote, RefreshCcw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import {
  usePredictVirality,
  type Video,
  type ViralityPrediction,
  type ViralityShapEntry,
} from '@workspace/api-client-react';
import { useViralityJob } from '@/hooks/useViralityJob';
import { cn } from '@/lib/utils';

interface ViralityPredictorCardProps {
  video: Video | null;
}

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

function ScoreTile({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value * 10));
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div
        className="relative h-12 w-12 rounded-full"
        style={{
          background: `conic-gradient(rgba(124,58,237,0.85) ${pct}%, rgba(255,255,255,0.06) ${pct}%)`,
        }}
      >
        <div className="absolute inset-1 flex items-center justify-center rounded-full bg-[#0b0a18]">
          <span className="text-sm font-display font-bold text-white">{value}</span>
        </div>
      </div>
      <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">{label}</span>
    </div>
  );
}

function ShapBar({ entry, kind }: { entry: ViralityShapEntry; kind: 'up' | 'down' }) {
  const magnitude = Math.min(1, Math.abs(entry.impact));
  const pct = Math.max(8, Math.round(magnitude * 100));
  const colorClass = kind === 'up'
    ? 'bg-emerald-500/35 border-emerald-500/40'
    : 'bg-rose-500/35 border-rose-500/40';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-white/75">{entry.msg}</span>
        <span className={cn(
          'shrink-0 text-[10px] font-mono font-semibold',
          kind === 'up' ? 'text-emerald-300/90' : 'text-rose-300/90',
        )}>
          {entry.impact > 0 ? '+' : ''}{entry.impact.toFixed(3)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className={cn('h-full rounded-full border', colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/45">{label}</div>
      <div className="text-xs font-semibold text-white/85 capitalize">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-6 text-center">
      <Sparkles className="mx-auto h-5 w-5 text-muted-foreground/40" />
      <p className="mt-2 text-sm text-white/60">Upload a video to see virality predictions.</p>
      <p className="text-xs text-muted-foreground/40">The model returns predicted views, viral tier, SHAP attributions, and an LLM analysis.</p>
    </div>
  );
}

function PredictionView({ prediction }: { prediction: ViralityPrediction }) {
  const llm = prediction.llm_analysis;
  // The LLM (Groq) step is non-fatal: if it fails or no key is set it comes
  // back empty. Only render the LLM-derived blocks when we actually have them.
  const hasLlm = Boolean(llm && typeof llm.hook_score === 'number');
  const shapUp = prediction.shap_pushing_up ?? [];
  const shapDown = prediction.shap_dragging_down ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 to-accent/5 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary/80">Predicted views</span>
          <span className="text-3xl font-display font-bold text-white">
            {NUMBER_FORMATTER.format(prediction.predicted_views_estimate)}
          </span>
          <span className="text-sm text-white/80">{prediction.viral_tier}</span>
        </div>
      </div>

      {prediction.hook_transcript && (
        <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
          <div className="flex items-start gap-2">
            <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
            <p className="text-xs italic text-white/75">{prediction.hook_transcript}</p>
          </div>
        </div>
      )}

      {!hasLlm && (
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3 text-xs text-amber-200/80">
          LLM analysis unavailable (no Groq API key, or the call failed). Predicted views, tier, and the
          SHAP attributions below are still valid — set <code className="font-mono">GROQ_API_KEY</code> and
          re-analyze for the full creative breakdown.
        </div>
      )}

      {hasLlm && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <ScoreTile label="Hook" value={llm.hook_score!} />
            <ScoreTile label="Clarity" value={llm.clarity_score!} />
            <ScoreTile label="Quality" value={llm.quality_score!} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Pill label="Category" value={llm.content_category ?? '—'} />
            <Pill label="Tone" value={llm.tone ?? '—'} />
            <Pill label="Emotion" value={llm.emotion ?? '—'} />
            <Pill label="Hook type" value={llm.hook_type ?? '—'} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300/80">
            <TrendingUp className="h-3 w-3" />
            Pushing virality up
          </div>
          <div className="space-y-2.5">
            {shapUp.length === 0 && (
              <p className="text-[11px] text-white/40">No strong positive signals detected.</p>
            )}
            {shapUp.map((entry) => (
              <ShapBar key={entry.msg} entry={entry} kind="up" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-rose-500/15 bg-rose-500/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300/80">
            <TrendingDown className="h-3 w-3" />
            Dragging virality down
          </div>
          <div className="space-y-2.5">
            {shapDown.length === 0 && (
              <p className="text-[11px] text-white/40">No strong negative signals detected.</p>
            )}
            {shapDown.map((entry) => (
              <ShapBar key={entry.msg} entry={entry} kind="down" />
            ))}
          </div>
        </div>
      </div>

      {hasLlm && (
        <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">LLM analysis</div>
          {llm.video_summary && (
            <p className="text-xs leading-relaxed text-white/75">{llm.video_summary}</p>
          )}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300/70">Strengths</div>
              <ul className="mt-1 list-disc pl-4 text-xs text-white/70 space-y-0.5">
                {(llm.strengths ?? []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-300/70">Weaknesses</div>
              <ul className="mt-1 list-disc pl-4 text-xs text-white/70 space-y-0.5">
                {(llm.weaknesses ?? []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
          {llm.improvement_suggestion && (
            <div className="mt-2 rounded-lg border border-primary/15 bg-primary/[0.06] p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary/80">Improvement suggestion</div>
              <p className="mt-1 text-xs text-white/80">{llm.improvement_suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ViralityPredictorCard({ video }: ViralityPredictorCardProps) {
  const predictMutation = usePredictVirality();
  const [jobId, setJobId] = useState<string | null>(null);
  const jobQuery = useViralityJob(jobId);

  const runPrediction = useCallback(
    (videoId: string, force: boolean) => {
      setJobId(null);
      predictMutation.mutate(
        { data: { videoId, force } },
        {
          // A cache hit returns the prediction inline (jobId null); a miss
          // returns a jobId we then poll until the worker finishes.
          onSuccess: (job) => setJobId(job.status === 'queued' ? job.jobId : null),
        },
      );
    },
    [predictMutation],
  );

  useEffect(() => {
    if (!video) {
      setJobId(null);
      predictMutation.reset();
      return;
    }
    runPrediction(video.id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  const polledJob = jobQuery.data;
  const prediction = polledJob?.prediction ?? predictMutation.data?.prediction ?? null;

  const isFailed = predictMutation.isError || polledJob?.status === 'failed';
  const isWaitingOnJob =
    jobId !== null && polledJob?.status !== 'done' && polledJob?.status !== 'failed';
  const isWorking = predictMutation.isPending || isWaitingOnJob;

  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/12 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-white">Virality Predictor</h3>
            <p className="text-[11px] text-muted-foreground/55">SHAP attributions + LLM analysis on every upload.</p>
          </div>
        </div>
        <button
          onClick={() => video && runPrediction(video.id, true)}
          disabled={!video || isWorking}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCcw className={cn('h-3 w-3', isWorking && 'animate-spin')} />
          Re-analyze
        </button>
      </div>

      {!video && <EmptyState />}

      {video && isWorking && (
        <div className="space-y-3">
          <div className="h-20 rounded-2xl bg-white/[0.04] animate-pulse" />
          <div className="h-10 rounded-xl bg-white/[0.04] animate-pulse" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      )}

      {video && !isWorking && isFailed && (
        <div className="rounded-xl border border-red-500/15 bg-red-500/8 p-3 text-sm text-red-300">
          Prediction failed. Hit "Re-analyze" to retry.
        </div>
      )}

      {video && !isWorking && !isFailed && prediction && (
        <PredictionView prediction={prediction} />
      )}
    </div>
  );
}
