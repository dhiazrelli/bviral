import { and, desc, eq } from "drizzle-orm";
import {
  type Database,
  type NewVideoRecord,
  type VideoRecord,
  videosTable,
} from "@workspace/db";

export type VideoStatus = "uploaded" | "processing" | "ready" | "failed";

export interface VideoResponseDto {
  id: string;
  userId: string;
  originalUrl: string;
  originalFilename: string | null;
  processedUrl: string | null;
  duration: number | null;
  status: VideoStatus;
  createdAt: string;
}

export interface CreateUploadedVideoPayload {
  userId: string;
  originalUrl: string;
  originalFilename?: string | null;
  contentHash?: string | null;
  duration?: number | null;
}

export interface VideosRepository {
  listForUser(userId: string): Promise<VideoResponseDto[]>;
  findForUser(videoId: string, userId: string): Promise<VideoResponseDto | null>;
  findByOriginalFilenameForUser(userId: string, originalFilename: string): Promise<VideoResponseDto | null>;
  findByContentHashForUser(userId: string, contentHash: string): Promise<VideoResponseDto | null>;
  createUploaded(input: CreateUploadedVideoPayload): Promise<VideoResponseDto>;
  updateStatus(videoId: string, status: VideoStatus): Promise<VideoResponseDto | null>;
}

function serializeVideo(video: VideoRecord): VideoResponseDto {
  return {
    id: video.id,
    userId: video.userId,
    originalUrl: video.originalUrl,
    originalFilename: video.originalFilename ?? null,
    processedUrl: video.processedUrl ?? null,
    duration: video.duration ?? null,
    status: video.status,
    createdAt: video.createdAt.toISOString(),
  };
}

export function buildVideosRepository(db: Database): VideosRepository {
  return {
    async listForUser(userId) {
      const videos = await db
        .select()
        .from(videosTable)
        .where(eq(videosTable.userId, userId))
        .orderBy(desc(videosTable.createdAt));

      return videos.map(serializeVideo);
    },

    async findForUser(videoId, userId) {
      const [video] = await db
        .select()
        .from(videosTable)
        .where(and(
          eq(videosTable.id, videoId),
          eq(videosTable.userId, userId),
        ))
        .limit(1);

      return video ? serializeVideo(video) : null;
    },

    async findByOriginalFilenameForUser(userId, originalFilename) {
      const [video] = await db
        .select()
        .from(videosTable)
        .where(and(
          eq(videosTable.userId, userId),
          eq(videosTable.originalFilename, originalFilename),
        ))
        .orderBy(desc(videosTable.createdAt))
        .limit(1);

      return video ? serializeVideo(video) : null;
    },

    async findByContentHashForUser(userId, contentHash) {
      const [video] = await db
        .select()
        .from(videosTable)
        .where(and(
          eq(videosTable.userId, userId),
          eq(videosTable.contentHash, contentHash),
        ))
        .orderBy(desc(videosTable.createdAt))
        .limit(1);

      return video ? serializeVideo(video) : null;
    },

    async createUploaded(input) {
      const payload: NewVideoRecord = {
        userId: input.userId,
        originalUrl: input.originalUrl,
        originalFilename: input.originalFilename ?? null,
        contentHash: input.contentHash ?? null,
        duration: input.duration ?? null,
        status: "uploaded",
      };

      const [video] = await db.insert(videosTable).values(payload).returning();
      return serializeVideo(video);
    },

    async updateStatus(videoId, status) {
      const [video] = await db
        .update(videosTable)
        .set({ status })
        .where(eq(videosTable.id, videoId))
        .returning();

      return video ? serializeVideo(video) : null;
    },
  };
}
