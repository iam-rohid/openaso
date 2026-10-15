CREATE TABLE `app_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'blue' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_keywords` (
	`app_id` text NOT NULL,
	`keyword_id` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`app_id`, `keyword_id`),
	FOREIGN KEY (`app_id`) REFERENCES `tracked_apps`(`app_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`keyword_id`) REFERENCES `keywords`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `apps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`subtitle` text,
	`developer` text DEFAULT '' NOT NULL,
	`developer_id` text,
	`bundle_id` text,
	`icon_url` text,
	`genre` text,
	`price` real DEFAULT 0,
	`formatted_price` text,
	`rating` real,
	`rating_count` integer DEFAULT 0,
	`description` text,
	`store_url` text,
	`release_date` integer,
	`updated_date` integer,
	`version` text,
	`country` text DEFAULT 'US' NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `keyword_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword_id` integer NOT NULL,
	`popularity` integer,
	`difficulty` integer,
	`result_count` integer,
	`ranked_app_ids` text NOT NULL,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`keyword_id`) REFERENCES `keywords`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `keyword_snapshots_keyword_idx` ON `keyword_snapshots` (`keyword_id`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`term` text NOT NULL,
	`country` text NOT NULL,
	`popularity` integer,
	`difficulty` integer,
	`result_count` integer,
	`ranked_app_ids` text NOT NULL,
	`last_fetched_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keywords_term_country_idx` ON `keywords` (`term`,`country`);--> statement-breakpoint
CREATE TABLE `search_hints` (
	`prefix` text NOT NULL,
	`country` text NOT NULL,
	`hints` text NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`prefix`, `country`)
);
--> statement-breakpoint
CREATE TABLE `tracked_apps` (
	`app_id` text PRIMARY KEY NOT NULL,
	`folder_id` integer,
	`default_country` text DEFAULT 'US' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `app_folders`(`id`) ON UPDATE no action ON DELETE set null
);
