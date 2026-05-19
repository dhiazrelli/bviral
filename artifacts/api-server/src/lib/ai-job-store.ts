import type Redis from "ioredis";
import type { AiJobKind } from "./ai-processing-queue";

export type AiJobStatus = "queued" | "running" | "done" | "failed";

export interface AiJobRecord {
  jobId: string;
  kind: AiJobKind;
  status: AiJobStatus;
  progress: number | null;
  resultUrl: string | null;
  videoId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const TTL_SECONDS = 60 * 60 * 24;
const DAILY_COUNTER_TTL_SECONDS = 60 * 60 * 26;

function key(jobId: string) {
  return `ai:job:${jobId}`;
}

function dailyKey(userId: string, day: string) {
  return `ai:ltx:daily:${userId}:${day}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toRecord(jobId: string, raw: Record<string, string>): AiJobRecord | null {
  if (!raw.kind || !raw.status) {
    return null;
  }

  return {
    jobId,
    kind: raw.kind as AiJobKind,
    status: raw.status as AiJobStatus,
    progress: raw.progress ? Number(raw.progress) : null,
    resultUrl: raw.resultUrl ?? null,
    videoId: raw.videoId ?? null,
    error: raw.error ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function toRedisFields(input: Partial<Omit<AiJobRecord, "jobId">>): Record<string, string> {
  const fields: Record<string, string> = {};
  if (input.kind !== undefined) fields.kind = input.kind;
  if (input.status !== undefined) fields.status = input.status;
  if (input.progress !== undefined && input.progress !== null) {
    fields.progress = String(input.progress);
  }
  if (input.resultUrl !== undefined && input.resultUrl !== null) {
    fields.resultUrl = input.resultUrl;
  }
  if (input.videoId !== undefined && input.videoId !== null) {
    fields.videoId = input.videoId;
  }
  if (input.error !== undefined && input.error !== null) {
    fields.error = input.error;
  }
  if (input.createdAt !== undefined) fields.createdAt = input.createdAt;
  if (input.updatedAt !== undefined) fields.updatedAt = input.updatedAt;
  return fields;
}

export interface AiJobStore {
  create(input: { jobId: string; kind: AiJobKind }): Promise<AiJobRecord>;
  update(jobId: string, patch: Partial<Omit<AiJobRecord, "jobId" | "kind" | "createdAt">>): Promise<void>;
  get(jobId: string): Promise<AiJobRecord | null>;
  incrementDailyLtxUsage(userId: string): Promise<number>;
  getDailyLtxUsage(userId: string): Promise<number>;
}

export function buildAiJobStore(redis: Redis): AiJobStore {
  return {
    async create({ jobId, kind }) {
      const now = new Date().toISOString();
      const record: AiJobRecord = {
        jobId,
        kind,
        status: "queued",
        progress: null,
        resultUrl: null,
        videoId: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      };
      await redis.hset(key(jobId), toRedisFields(record));
      await redis.expire(key(jobId), TTL_SECONDS);
      return record;
    },

    async update(jobId, patch) {
      const fields = toRedisFields({ ...patch, updatedAt: new Date().toISOString() });
      if (Object.keys(fields).length === 0) return;
      await redis.hset(key(jobId), fields);
      await redis.expire(key(jobId), TTL_SECONDS);
    },

    async get(jobId) {
      const raw = await redis.hgetall(key(jobId));
      if (!raw || Object.keys(raw).length === 0) return null;
      return toRecord(jobId, raw);
    },

    async incrementDailyLtxUsage(userId) {
      const k = dailyKey(userId, today());
      const next = await redis.incr(k);
      if (next === 1) {
        await redis.expire(k, DAILY_COUNTER_TTL_SECONDS);
      }
      return next;
    },

    async getDailyLtxUsage(userId) {
      const raw = await redis.get(dailyKey(userId, today()));
      return raw ? Number(raw) : 0;
    },
  };
}

