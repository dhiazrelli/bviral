ALTER TYPE "public"."post_status" ADD VALUE IF NOT EXISTS 'cancelled';--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "original_filename" varchar(255);
