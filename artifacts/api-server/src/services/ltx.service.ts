// Pricing table for cost estimation only. The authoritative cost lives on
// LTX's invoice; this is a UI-side guess so users can see what a generation
// will roughly burn before they click confirm.
const PRICE_TABLE_USD_PER_SECOND: Record<string, Record<string, number>> = {
  "ltx-2-3-fast": {
    "1080x1920": 0.06,
    "1920x1080": 0.06,
    "1440x2560": 0.10,
  },
  "ltx-2-3-pro": {
    "1080x1920": 0.18,
    "1920x1080": 0.18,
    "1440x2560": 0.30,
  },
};

export function estimateLtxCostUsd(input: {
  model: string;
  resolution: string;
  durationSec: number;
}): number {
  const perSecond = PRICE_TABLE_USD_PER_SECOND[input.model]?.[input.resolution] ?? 0.06;
  return Number((perSecond * input.durationSec).toFixed(4));
}

export class LtxConfigurationError extends Error {
  readonly name = "LtxConfigurationError";
  readonly statusCode = 503;

  constructor() {
    super("LTX Studio is not configured. Set LTXV_API_KEY to enable text-to-video generation.");
  }
}

export class LtxApiError extends Error {
  readonly name = "LtxApiError";

  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

export interface LtxGenerationInput {
  prompt: string;
  style?: string;
  durationSec: number;
  resolution: string;
  model: string;
}

export interface LtxService {
  isConfigured(): boolean;
  generateVideo(input: LtxGenerationInput): Promise<{ mp4: Buffer; contentType: string }>;
}

function composePrompt(prompt: string, style?: string): string {
  const trimmed = prompt.trim();
  if (!style || !style.trim() || style === "None") {
    return trimmed;
  }
  return `${trimmed}, in ${style.trim()} style`;
}

export function buildLtxService(options: {
  apiKey?: string;
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
}): LtxService {
  const fetchFn = options.fetchImpl ?? fetch;

  return {
    isConfigured() {
      return Boolean(options.apiKey);
    },

    async generateVideo(input) {
      if (!options.apiKey) {
        throw new LtxConfigurationError();
      }

      const body = {
        prompt: composePrompt(input.prompt, input.style),
        model: input.model,
        duration: input.durationSec,
        resolution: input.resolution,
      };

      const response = await fetchFn(`${options.apiBaseUrl}/text-to-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "video/mp4",
          "Authorization": `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;
        try {
          const text = await response.text();
          if (text) detail = `${detail}: ${text.slice(0, 500)}`;
        } catch {
          // ignore — propagate status detail only
        }
        throw new LtxApiError(`LTX text-to-video failed (${detail})`, response.status);
      }

      const contentType = response.headers.get("content-type") ?? "video/mp4";
      const arrayBuffer = await response.arrayBuffer();
      return { mp4: Buffer.from(arrayBuffer), contentType };
    },
  };
}
