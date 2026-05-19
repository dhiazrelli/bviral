-- Add content_hash (sha256 hex) to videos for true dedup by file content.
-- Nullable so existing rows stay valid; only new uploads will be hashed.
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "content_hash" varchar(64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_user_content_hash_idx" ON "videos" ("user_id", "content_hash");
