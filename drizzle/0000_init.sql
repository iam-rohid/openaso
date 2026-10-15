CREATE TABLE "app_keywords" (
	"app_id" text NOT NULL,
	"keyword_id" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_keywords_app_id_keyword_id_pk" PRIMARY KEY("app_id","keyword_id")
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"developer" text DEFAULT '' NOT NULL,
	"developer_id" text,
	"bundle_id" text,
	"icon_url" text,
	"genre" text,
	"price" real DEFAULT 0,
	"formatted_price" text,
	"rating" real,
	"rating_count" integer DEFAULT 0,
	"description" text,
	"store_url" text,
	"release_date" timestamp with time zone,
	"updated_date" timestamp with time zone,
	"version" text,
	"country" text DEFAULT 'US' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword_id" integer NOT NULL,
	"popularity" integer,
	"difficulty" integer,
	"result_count" integer,
	"ranked_app_ids" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"term" text NOT NULL,
	"country" text NOT NULL,
	"popularity" integer,
	"difficulty" integer,
	"result_count" integer,
	"ranked_app_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_hints" (
	"prefix" text NOT NULL,
	"country" text NOT NULL,
	"hints" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_hints_prefix_country_pk" PRIMARY KEY("prefix","country")
);
--> statement-breakpoint
CREATE TABLE "tracked_apps" (
	"app_id" text PRIMARY KEY NOT NULL,
	"default_country" text DEFAULT 'US' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_keywords" ADD CONSTRAINT "app_keywords_app_id_tracked_apps_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."tracked_apps"("app_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_keywords" ADD CONSTRAINT "app_keywords_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_snapshots" ADD CONSTRAINT "keyword_snapshots_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_apps" ADD CONSTRAINT "tracked_apps_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "keyword_snapshots_keyword_idx" ON "keyword_snapshots" USING btree ("keyword_id","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_term_country_idx" ON "keywords" USING btree ("term","country");--> statement-breakpoint
CREATE INDEX "keywords_ranked_app_ids_idx" ON "keywords" USING gin ("ranked_app_ids");