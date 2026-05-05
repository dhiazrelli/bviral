CREATE TYPE "public"."alert_status" AS ENUM('unresolved', 'resolved');--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "status" "alert_status" DEFAULT 'unresolved' NOT NULL;