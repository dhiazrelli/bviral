import type Redis from "ioredis";

export type ViralityJobStatus = "queued" | "running" | "done" | "failed";

export interface ViralityJobRecord {
  jobId: string;
  status: ViralityJobStatus;
  videoId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// Job lifecycle only — the heavy prediction payload lives in Postgres
// (virality_predictions), not Redis. Mirrors the TTL used by ai-job-store.
const TTL_SECONDS = 60 * 60 * 24;

function key(jobId: string) {
  return `virality:job:${jobId}`;
}

function toRecord(jobId: string, raw: Record<string, string>): ViralityJobRecord | null {
  if (!raw.status) {
    return null;
  }
  return {
    jobId,
    status: raw.status as ViralityJobStatus,
    videoId: raw.videoId ?? null,
    error: raw.error ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function toFields(input: Partial<Omit<ViralityJobRecord, "jobId">>): Record<string, string> {
  const fields: Record<string, string> = {};
  if (input.status !== undefined) fields.status = input.status;
  if (input.videoId !== undefined && input.videoId !== null) fields.videoId = input.videoId;
  if (input.error !== undefined && input.error !== null) fields.error = input.error;
  if (input.createdAt !== undefined) fields.createdAt = input.createdAt;
  if (input.updatedAt !== undefined) fields.updatedAt = input.updatedAt;
  return fields;
}

export interface ViralityJobStore {
  create(input: { jobId: string; videoId: string }): Promise<ViralityJobRecord>;
  update(jobId: string, patch: Partial<Pick<ViralityJobRecord, "status" | "error">>): Promise<void>;
  get(jobId: string): Promise<ViralityJobRecord | null>;
}

export function buildViralityJobStore(redis: Redis): ViralityJobStore {
  return {
    async create({ jobId, videoId }) {
      const now = new Date().toISOString();
      const record: ViralityJobRecord = {
        jobId,
        status: "queued",
        videoId,
        error: null,
        createdAt: now,
        updatedAt: now,
      };
      await redis.hset(key(jobId), toFields(record));
      await redis.expire(key(jobId), TTL_SECONDS);
      return record;
    },

    async update(jobId, patch) {
      const fields = toFields({ ...patch, updatedAt: new Date().toISOString() });
      if (Object.keys(fields).length === 0) return;
      await redis.hset(key(jobId), fields);
      await redis.expire(key(jobId), TTL_SECONDS);
    },

    async get(jobId) {
      const raw = await redis.hgetall(key(jobId));
      if (!raw || Object.keys(raw).length === 0) return null;
      return toRecord(jobId, raw);
    },
  };
}
