// Mirror of the backend cost estimator (artifacts/api-server/src/services/ltx.service.ts).
// Kept in sync manually — used only for the pre-generation cost preview; the
// authoritative `estimatedCostUsd` comes back from the API on submit.
const PRICE_TABLE_USD_PER_SECOND: Record<string, Record<string, number>> = {
  'ltx-2-3-fast': {
    '1080x1920': 0.06,
    '1920x1080': 0.06,
    '1440x2560': 0.10,
  },
  'ltx-2-3-pro': {
    '1080x1920': 0.18,
    '1920x1080': 0.18,
    '1440x2560': 0.30,
  },
};

export function estimateLtxCostUsd(input: {
  model?: string;
  resolution: string;
  durationSec: number;
}): number {
  const model = input.model ?? 'ltx-2-3-fast';
  const perSecond = PRICE_TABLE_USD_PER_SECOND[model]?.[input.resolution] ?? 0.06;
  return Number((perSecond * input.durationSec).toFixed(4));
}
