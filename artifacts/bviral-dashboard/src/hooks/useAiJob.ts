import { getGetAiJobQueryKey, useGetAiJob } from '@workspace/api-client-react';

const POLL_INTERVAL_MS = 1500;

export function useAiJob(jobId: string | null) {
  const effectiveId = jobId ?? '';
  return useGetAiJob(effectiveId, {
    query: {
      queryKey: getGetAiJobQueryKey(effectiveId),
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
