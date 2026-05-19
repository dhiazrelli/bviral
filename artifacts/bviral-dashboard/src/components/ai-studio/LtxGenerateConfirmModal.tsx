import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface LtxGenerateConfirmModalProps {
  open: boolean;
  prompt: string;
  durationSec: number;
  resolution: string;
  estimatedCostUsd: number;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function LtxGenerateConfirmModal({
  open,
  prompt,
  durationSec,
  resolution,
  estimatedCostUsd,
  onConfirm,
  onCancel,
  isPending,
}: LtxGenerateConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 mx-4 relative">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-muted-foreground/60 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-white">Confirm LTX generation</h2>
            <p className="text-xs text-muted-foreground/60">This will spend credits on your LTX Studio account.</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/45">Prompt</div>
            <p className="mt-1 text-xs text-white/85 line-clamp-4">{prompt}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/45">Duration</div>
              <div className="text-sm font-semibold text-white/90">{durationSec}s</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/45">Resolution</div>
              <div className="text-sm font-semibold text-white/90">{resolution}</div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/8 px-3 py-2">
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-primary/70">Est. cost</div>
              <div className="text-sm font-semibold text-white">${estimatedCostUsd.toFixed(3)}</div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/55 leading-relaxed">
            Estimate based on LTX Studio's posted per-second pricing. The authoritative cost lives on your LTX invoice.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="btn-accent disabled:opacity-40"
          >
            {isPending ? 'Submitting...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
