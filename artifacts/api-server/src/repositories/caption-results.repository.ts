import { and, eq } from "drizzle-orm";
import {
  type CaptionResultRecord,
  captionResultsTable,
  type Database,
} from "@workspace/db";

export interface CaptionResultDto {
  videoId: string;
  style: string;
  wordsPerFlash: number;
  modelSize: string;
  previewUrl: string;
  transcript: string | null;
}

export interface CaptionResultParams {
  videoId: string;
  style: string;
  wordsPerFlash: number;
  modelSize: string;
}

export interface UpsertCaptionResultInput extends CaptionResultParams {
  userId: string;
  previewUrl: string;
  transcript?: string | null;
}

export interface CaptionResultsRepository {
  /** Cached caption preview for a video + exact generation settings, or null. */
  findByParams(params: CaptionResultParams): Promise<CaptionResultDto | null>;
  upsert(input: UpsertCaptionResultInput): Promise<void>;
}

function serialize(row: CaptionResultRecord): CaptionResultDto {
  return {
    videoId: row.videoId,
    style: row.style,
    wordsPerFlash: row.wordsPerFlash,
    modelSize: row.modelSize,
    previewUrl: row.previewUrl,
    transcript: row.transcript ?? null,
  };
}

export function buildCaptionResultsRepository(db: Database): CaptionResultsRepository {
  return {
    async findByParams({ videoId, style, wordsPerFlash, modelSize }) {
      const [row] = await db
        .select()
        .from(captionResultsTable)
        .where(and(
          eq(captionResultsTable.videoId, videoId),
          eq(captionResultsTable.style, style),
          eq(captionResultsTable.wordsPerFlash, wordsPerFlash),
          eq(captionResultsTable.modelSize, modelSize),
        ))
        .limit(1);

      return row ? serialize(row) : null;
    },

    async upsert({ videoId, userId, style, wordsPerFlash, modelSize, previewUrl, transcript }) {
      await db
        .insert(captionResultsTable)
        .values({
          videoId,
          userId,
          style,
          wordsPerFlash,
          modelSize,
          previewUrl,
          transcript: transcript ?? null,
        })
        .onConflictDoUpdate({
          target: [
            captionResultsTable.videoId,
            captionResultsTable.style,
            captionResultsTable.wordsPerFlash,
            captionResultsTable.modelSize,
          ],
          set: {
            previewUrl,
            transcript: transcript ?? null,
            updatedAt: new Date(),
          },
        });
    },
  };
}
