import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { VideoProcessingQueue } from "../lib/video-processing-queue";
import type {
  VideoResponseDto,
  VideosRepository,
} from "../repositories/videos.repository";

export const videoParamsSchema = z.object({
  id: z.string().uuid(),
});

export class VideoNotFoundError extends Error {
  readonly name = "VideoNotFoundError";

  constructor() {
    super("Video was not found.");
  }
}

export class VideoUploadConfigurationError extends Error {
  readonly name = "VideoUploadConfigurationError";

  constructor() {
    super("Supabase service role key is required for video uploads.");
  }
}

export class VideoUploadValidationError extends Error {
  readonly name = "VideoUploadValidationError";

  constructor(message: string) {
    super(message);
  }
}

export class DuplicateVideoFilenameError extends Error {
  readonly name = "DuplicateVideoFilenameError";
  readonly existing: VideoResponseDto;
  readonly matchedBy: "content" | "filename";

  constructor(existing: VideoResponseDto, matchedBy: "content" | "filename" = "filename") {
    const reason = matchedBy === "content"
      ? "the same file content is already in your library"
      : `a video named "${existing.originalFilename}" already exists for this user`;
    super(`Upload skipped — ${reason}.`);
    this.existing = existing;
    this.matchedBy = matchedBy;
  }
}

function sanitizeOriginalFilename(filename: string | undefined): string | null {
  if (!filename) return null;
  // Strip any path component; keep only the base name. Trim whitespace.
  const base = filename.split(/[\\/]/u).pop()?.trim() ?? "";
  if (!base) return null;
  return base.slice(0, 255);
}

export interface UploadVideoInput {
  file: MultipartFile | undefined;
  userId: string;
}

export interface VideosService {
  listVideos(userId: string): Promise<VideoResponseDto[]>;
  getVideo(videoId: string, userId: string): Promise<VideoResponseDto>;
  uploadVideo(input: UploadVideoInput): Promise<VideoResponseDto>;
}

function sanitizeExtension(filename: string) {
  const extension = extname(filename).toLowerCase();

  if (!extension || extension.length > 12 || !/^\.[a-z0-9]+$/u.test(extension)) {
    return ".mp4";
  }

  return extension;
}

function assertVideoFile(file: MultipartFile | undefined): asserts file is MultipartFile {
  if (!file) {
    throw new VideoUploadValidationError("Video file is required.");
  }

  if (!file.mimetype.startsWith("video/")) {
    throw new VideoUploadValidationError("Uploaded file must be a video.");
  }
}

async function ensureBucket(supabaseAdmin: SupabaseClient, bucketName: string) {
  const { data, error } = await supabaseAdmin.storage.getBucket(bucketName);

  if (!error && data) {
    if (!data.public) {
      const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucketName, {
        public: true,
      });

      if (updateError) {
        throw updateError;
      }
    }

    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
    public: true,
  });

  if (createError && createError.message !== "Bucket already exists") {
    throw createError;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Video processing queue did not respond.")), timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timeout));
  });
}

export function buildVideosService(
  videosRepository: VideosRepository,
  options: {
    supabaseAdmin: SupabaseClient | null;
    videoProcessingQueue: VideoProcessingQueue;
    videoBucket: string;
    skipProcessingQueue?: boolean;
  },
): VideosService {
  return {
    listVideos(userId) {
      return videosRepository.listForUser(userId);
    },

    async getVideo(videoId, userId) {
      const video = await videosRepository.findForUser(videoId, userId);

      if (!video) {
        throw new VideoNotFoundError();
      }

      return video;
    },

    async uploadVideo({ file, userId }) {
      if (!options.supabaseAdmin) {
        throw new VideoUploadConfigurationError();
      }

      assertVideoFile(file);

      const originalFilename = sanitizeOriginalFilename(file.filename);
      const buffer = await file.toBuffer();
      const contentHash = createHash("sha256").update(buffer).digest("hex");

      // Primary dedupe: by content hash. Catches renamed copies of the same file.
      const existingByHash = await videosRepository.findByContentHashForUser(userId, contentHash);
      if (existingByHash) {
        throw new DuplicateVideoFilenameError(existingByHash, "content");
      }

      const extension = sanitizeExtension(file.filename);
      const storagePath = `${userId}/original/${randomUUID()}${extension}`;

      await ensureBucket(options.supabaseAdmin, options.videoBucket);

      const { data, error } = await options.supabaseAdmin.storage
        .from(options.videoBucket)
        .upload(storagePath, buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        throw error;
      }

      const publicUrl = options.supabaseAdmin.storage
        .from(options.videoBucket)
        .getPublicUrl(data.path).data.publicUrl;

      const video = await videosRepository.createUploaded({
        userId,
        originalUrl: publicUrl,
        originalFilename,
        contentHash,
      });

      if (options.skipProcessingQueue) {
        return video;
      }

      try {
        await withTimeout(
          options.videoProcessingQueue.add("process-video", {
            videoId: video.id,
            userId,
          }),
          3_000,
        );
      } catch {
        // Uploads are still usable for scheduling even when the local
        // processing queue is not running.
      }

      return video;
    },
  };
}
