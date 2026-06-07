import { getGetViralityJobQueryKey, useGetViralityJob } from '@workspace/api-client-react';

// Virality analysis (CLIP + Whisper + LLM) takes tens of seconds, so poll a
// little slower than the generic AI job hook.
const POLL_INTERVAL_MS = 2000;

export function useViralityJob(jobId: string | null) {
  const effectiveId = jobId ?? '';
  return useGetViralityJob(effectiveId, {
    query: {
      queryKey: getGetViralityJobQueryKey(effectiveId),
      enabled: Boolean(jobId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (!status || status === 'done' || status === 'failed') {
          return false;
        }
        return POLL_INTERVAL_MS;
      },
    },
  });
}
