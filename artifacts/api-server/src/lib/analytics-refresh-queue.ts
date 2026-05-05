export const analyticsRefreshQueueName = "analytics-refresh";
export const analyticsRefreshJobName = "refresh-post-analytics";
export const analyticsRefreshJobId = "analytics-refresh-every-six-hours";
export const analyticsRefreshCronPattern = "0 */6 * * *";

export type AnalyticsRefreshJob = Record<string, never>;

export interface AnalyticsRefreshQueue {
  scheduleEverySixHours(): Promise<unknown>;
  close(): Promise<void>;
}
