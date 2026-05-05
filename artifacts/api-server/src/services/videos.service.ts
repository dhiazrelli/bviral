import { randomUUID } from "node:crypto";
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
    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
    public: false,
  });

  if (createError && createError.message !== "Bucket already exists") {
    throw createError;
  }
}

export function buildVideosService(
  videosRepository: VideosRepository,
  options: {
    supabaseAdmin: SupabaseClient | null;
    videoProcessingQueue: VideoProcessingQueue;
    videoBucket: string;
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

      const buffer = await file.toBuffer();
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
      });

      await options.videoProcessingQueue.add("process-video", {
        videoId: video.id,
        userId,
      });

      return video;
    },
  };
}
