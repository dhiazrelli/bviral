import { Queue, Worker } from "bullmq";
import { createDatabase, createPool } from "@workspace/db";
import {
  analyticsRefreshCronPattern,
  type AnalyticsRefreshJob,
  analyticsRefreshJobId,
  analyticsRefreshJobName,
  analyticsRefreshQueueName,
} from "../lib/analytics-refresh-queue";
import { resolveConfig } from "../lib/config";
import { loadEnv } from "../lib/load-env";
import { createRedisConnection } from "../lib/redis";
import { buildAccountsRepository } from "../repositories/accounts.repository";
import { buildAnalyticsRepository } from "../repositories/analytics.repository";
import { buildAnalyticsService } from "../services/analytics.service";

loadEnv();

const config = resolveConfig();
const pool = createPool(config.databaseUrl, {
  max: config.dbPoolMax,
});
const db = createDatabase(pool);
const accountsRepository = buildAccountsRepository(db);
const analyticsRepository = buildAnalyticsRepository(db);
const analyticsService = buildAnalyticsService(
  config,
  analyticsRepository,
  accountsRepository,
);
const redis = createRedisConnection(config.redisUrl);
const queue = new Queue<AnalyticsRefreshJob>(analyticsRefreshQueueName, {
  connection: redis,
});

await queue.add(analyticsRefreshJobName, {}, {
  jobId: analyticsRefreshJobId,
  repeat: {
    pattern: analyticsRefreshCronPattern,
  },
});

const worker = new Worker<AnalyticsRefreshJob>(
  analyticsRefreshQueueName,
  async () => analyticsService.refreshPostedPostAnalytics(),
  { connection: redis },
);

worker.on("completed", (job, summary) => {
  console.info({ jobId: job.id, summary }, "Analytics refresh job completed");
});

worker.on("failed", (job, error) => {
  console.error({ jobId: job?.id, err: error }, "Analytics refresh job failed");
});

async function shutdown() {
  await worker.close();
  await queue.close();
  redis.disconnect();
  await pool.end();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  });
}
