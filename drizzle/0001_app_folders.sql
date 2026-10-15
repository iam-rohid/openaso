CREATE TABLE "app_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracked_apps" ADD COLUMN "folder_id" integer;--> statement-breakpoint
ALTER TABLE "tracked_apps" ADD CONSTRAINT "tracked_apps_folder_id_app_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."app_folders"("id") ON DELETE set null ON UPDATE no action;