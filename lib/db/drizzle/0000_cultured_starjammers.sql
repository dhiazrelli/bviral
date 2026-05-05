CREATE TYPE "public"."alert_type" AS ENUM('error', 'copyright', 'success');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('facebook', 'instagram', 'tiktok', 'youtube', 'snapchat');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('scheduled', 'posted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."video_status" AS ENUM('uploaded', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform" NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expiry" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "alert_type" NOT NULL,
	"message" text NOT NULL,
	"platform" "platform" NOT NULL,
	"account_id" uuid,
	"post_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(12, 2) DEFAULT 0 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"posted_at" timestamp with time zone,
	"status" "post_status" DEFAULT 'scheduled' NOT NULL,
	"external_post_id" varchar(255),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"original_url" text NOT NULL,
	"processed_url" text,
	"duration" integer,
	"status" "video_status" DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "videos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "accounts_select_own" ON "accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("accounts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "accounts_insert_own" ON "accounts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("accounts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "accounts_update_own" ON "accounts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("accounts"."user_id" = (select auth.uid())) WITH CHECK ("accounts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "accounts_delete_own" ON "accounts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("accounts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "alerts_select_own" ON "alerts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((
    (
      "alerts"."account_id" is not null
      and exists (
        select 1 from "accounts"
        where "accounts"."id" = "alerts"."account_id"
          and "accounts"."user_id" = (select auth.uid())
      )
    )
    or (
      "alerts"."post_id" is not null
      and exists (
        select 1
        from "posts"
        inner join "accounts"
          on "accounts"."id" = "posts"."account_id"
        where "posts"."id" = "alerts"."post_id"
          and "accounts"."user_id" = (select auth.uid())
      )
    )
  ));--> statement-breakpoint
CREATE POLICY "alerts_insert_own" ON "alerts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((
    (
      "alerts"."account_id" is not null
      and exists (
        select 1 from "accounts"
        where "accounts"."id" = "alerts"."account_id"
          and "accounts"."user_id" = (select auth.uid())
      )
    )
    or (
      "alerts"."post_id" is not null
      and exists (
        select 1
        from "posts"
        inner join "accounts"
          on "accounts"."id" = "posts"."account_id"
        where "posts"."id" = "alerts"."post_id"
          and "accounts"."user_id" = (select auth.uid())
      )
    )
  ));--> statement-breakpoint
CREATE POLICY "alerts_update_own" ON "alerts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((
    (
      "alerts"."account_id" is not null
      and exists (
        select 1 from "accounts"
        where "accounts"."id" = "alerts"."account_id"
          and "accounts"."user_id" = (select auth.uid())
      )
    )
    or (
      "alerts"."post_id" is not null
      and exists (
        select 1
        from "posts"
        inner join "accounts"
          on "accounts"."id" = "posts"."account_id"
        where "posts"."id" = "alerts"."post_id"
          and "accounts"."user_id" = (select auth.uid())
      )
    )
  )) WITH CHECK ((
    (
      "alerts"."account_id" is not null
      and exists (
        select 1 from "accounts"
        where "accounts"."id" = "alerts"."account_id"
          and "accounts"."user_id" = (select auth.uid())
      )
    )
    or (
      "alerts"."post_id" is not null
      and exists (
        select 1
        from "posts"
        inner join "accounts"
          on "accounts"."id" = "posts"."account_id"
        where "posts"."id" = "alerts"."post_id"
          and "accounts"."user_id" = (select auth.uid())
      )
    )
  ));--> statement-breakpoint
CREATE POLICY "alerts_delete_own" ON "alerts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((
    (
      "alerts"."account_id" is not null
      and exists (
        select 1 from "accounts"
        where "accounts"."id" = "alerts"."account_id"
          and "accounts"."user_id" = (select auth.uid())
      )
    )
    or (
      "alerts"."post_id" is not null
      and exists (
        select 1
        from "posts"
        inner join "accounts"
          on "accounts"."id" = "posts"."account_id"
        where "posts"."id" = "alerts"."post_id"
          and "accounts"."user_id" = (select auth.uid())
      )
    )
  ));--> statement-breakpoint
CREATE POLICY "analytics_select_own" ON "analytics" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
    select 1
    from "posts"
    inner join "accounts"
      on "accounts"."id" = "posts"."account_id"
    where "posts"."id" = "analytics"."post_id"
      and "accounts"."user_id" = (select auth.uid())
  ));--> statement-breakpoint
CREATE POLICY "analytics_insert_own" ON "analytics" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
    select 1
    from "posts"
    inner join "accounts"
      on "accounts"."id" = "posts"."account_id"
    where "posts"."id" = "analytics"."post_id"
      and "accounts"."user_id" = (select auth.uid())
  ));--> statement-breakpoint
CREATE POLICY "analytics_update_own" ON "analytics" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
    select 1
    from "posts"
    inner join "accounts"
      on "accounts"."id" = "posts"."account_id"
    where "posts"."id" = "analytics"."post_id"
      and "accounts"."user_id" = (select auth.uid())
  )) WITH CHECK (exists (
    select 1
    from "posts"
    inner join "accounts"
      on "accounts"."id" = "posts"."account_id"
    where "posts"."id" = "analytics"."post_id"
      and "accounts"."user_id" = (select auth.uid())
  ));--> statement-breakpoint
CREATE POLICY "analytics_delete_own" ON "analytics" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
    select 1
    from "posts"
    inner join "accounts"
      on "accounts"."id" = "posts"."account_id"
    where "posts"."id" = "analytics"."post_id"
      and "accounts"."user_id" = (select auth.uid())
  ));--> statement-breakpoint
CREATE POLICY "posts_select_own" ON "posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
    select 1 from "accounts"
    where "accounts"."id" = "posts"."account_id"
      and "accounts"."user_id" = (select auth.uid())
  ));--> statement-breakpoint
CREATE POLICY "posts_insert_own" ON "posts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
    select 1 from "accounts"
    where "accounts"."id" = "posts"."account_id"
      and "accounts"."user_id" = (select auth.uid())
  ) and exists (
    select 1 from "videos"
    where "videos"."id" = "posts"."video_id"
      and "videos"."user_id" = (select auth.uid())
  ));--> statement-breakpoint
CREATE POLICY "posts_update_own" ON "posts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
    select 1 from "accounts"
    where "accounts"."id" = "posts"."account_id"
      and "accounts"."user_id" = (select auth.uid())
  )) WITH CHECK (exists (
    select 1 from "accounts"
    where "accounts"."id" = "posts"."account_id"
      and "accounts"."user_id" = (select auth.uid())
  ) and exists (
    select 1 from "videos"
    where "videos"."id" = "posts"."video_id"
      and "videos"."user_id" = (select auth.uid())
  ));--> statement-breakpoint
CREATE POLICY "posts_delete_own" ON "posts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
    select 1 from "accounts"
    where "accounts"."id" = "posts"."account_id"
      and "accounts"."user_id" = (select auth.uid())
  ));--> statement-breakpoint
CREATE POLICY "videos_select_own" ON "videos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("videos"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "videos_insert_own" ON "videos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("videos"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "videos_update_own" ON "videos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("videos"."user_id" = (select auth.uid())) WITH CHECK ("videos"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "videos_delete_own" ON "videos" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("videos"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "users_select_own" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("users"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "users_insert_own" ON "users" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("users"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "users_update_own" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("users"."id" = (select auth.uid())) WITH CHECK ("users"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "users_delete_own" ON "users" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("users"."id" = (select auth.uid()));
