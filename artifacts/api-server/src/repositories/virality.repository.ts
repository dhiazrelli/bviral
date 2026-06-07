import { eq } from "drizzle-orm";
import {
  type Database,
  type ViralityPredictionPayload,
  viralityPredictionsTable,
} from "@workspace/db";

export type { ViralityPredictionPayload };

export interface UpsertViralityPredictionInput {
  videoId: string;
  userId: string;
  prediction: ViralityPredictionPayload;
  modelVersion?: string | null;
}

export interface ViralityRepository {
  /** Cached prediction for a video, or null. videoId is globally unique. */
  findByVideo(videoId: string): Promise<ViralityPredictionPayload | null>;
  upsert(input: UpsertViralityPredictionInput): Promise<void>;
}

export function buildViralityRepository(db: Database): ViralityRepository {
  return {
    async findByVideo(videoId) {
      const [row] = await db
        .select({ prediction: viralityPredictionsTable.prediction })
        .from(viralityPredictionsTable)
        .where(eq(viralityPredictionsTable.videoId, videoId))
        .limit(1);

      return row ? row.prediction : null;
    },

    async upsert({ videoId, userId, prediction, modelVersion }) {
      await db
        .insert(viralityPredictionsTable)
        .values({
          videoId,
          userId,
          prediction,
          modelVersion: modelVersion ?? null,
        })
        .onConflictDoUpdate({
          target: viralityPredictionsTable.videoId,
          set: {
            prediction,
            modelVersion: modelVersion ?? null,
            updatedAt: new Date(),
          },
        });
    },
  };
}
