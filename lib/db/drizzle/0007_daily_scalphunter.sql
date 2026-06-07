-- Cached virality predictions: one row per video, holding the full ViralAgent
-- report as JSON so re-opening a video is instant and the slow/paid pipeline
-- isn't re-run. Idempotent so it is safe to re-apply.
CREATE TABLE IF NOT EXISTS "virality_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"prediction" jsonb NOT NULL,
	"model_version" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "virality_predictions_video_id_unique" UNIQUE("video_id")
);
--> statement-breakpoint
ALTER TABLE "virality_predictions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "virality_predictions" ADD CONSTRAINT "virality_predictions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "virality_predictions" ADD CONSTRAINT "virality_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DROP POLICY IF EXISTS "admins_full_access_virality_predictions" ON "virality_predictions";--> statement-breakpoint
CREATE POLICY "admins_full_access_virality_predictions" ON "virality_predictions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((auth.jwt() ->> 'app_role') = 'admin') WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');--> statement-breakpoint
DROP POLICY IF EXISTS "virality_predictions_select_own" ON "virality_predictions";--> statement-breakpoint
CREATE POLICY "virality_predictions_select_own" ON "virality_predictions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("virality_predictions"."user_id" = (select auth.uid()));--> statement-breakpoint
DROP POLICY IF EXISTS "virality_predictions_insert_own" ON "virality_predictions";--> statement-breakpoint
CREATE POLICY "virality_predictions_insert_own" ON "virality_predictions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("virality_predictions"."user_id" = (select auth.uid()));--> statement-breakpoint
DROP POLICY IF EXISTS "virality_predictions_update_own" ON "virality_predictions";--> statement-breakpoint
CREATE POLICY "virality_predictions_update_own" ON "virality_predictions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("virality_predictions"."user_id" = (select auth.uid())) WITH CHECK ("virality_predictions"."user_id" = (select auth.uid()));--> statement-breakpoint
DROP POLICY IF EXISTS "virality_predictions_delete_own" ON "virality_predictions";--> statement-breakpoint
CREATE POLICY "virality_predictions_delete_own" ON "virality_predictions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("virality_predictions"."user_id" = (select auth.uid()));
