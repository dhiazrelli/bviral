CREATE TABLE "caption_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"style" varchar(16) NOT NULL,
	"words_per_flash" integer NOT NULL,
	"model_size" varchar(16) NOT NULL,
	"preview_url" text NOT NULL,
	"transcript" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "caption_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "caption_results" ADD CONSTRAINT "caption_results_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caption_results" ADD CONSTRAINT "caption_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "caption_results_video_settings_idx" ON "caption_results" USING btree ("video_id","style","words_per_flash","model_size");--> statement-breakpoint
CREATE POLICY "admins_full_access_caption_results" ON "caption_results" AS PERMISSIVE FOR ALL TO "authenticated" USING ((auth.jwt() ->> 'app_role') = 'admin') WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');--> statement-breakpoint
CREATE POLICY "caption_results_select_own" ON "caption_results" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("caption_results"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "caption_results_insert_own" ON "caption_results" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("caption_results"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "caption_results_update_own" ON "caption_results" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("caption_results"."user_id" = (select auth.uid())) WITH CHECK ("caption_results"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "caption_results_delete_own" ON "caption_results" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("caption_results"."user_id" = (select auth.uid()));