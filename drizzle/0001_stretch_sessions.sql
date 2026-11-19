CREATE TABLE `stretch_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`length` text NOT NULL,
	`seed` integer NOT NULL,
	`plan_json` text NOT NULL,
	`completed_json` text DEFAULT '[]' NOT NULL,
	`skipped_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer
);
--> statement-breakpoint
CREATE INDEX `stretch_sessions_status_idx` ON `stretch_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `stretch_sessions_ended_idx` ON `stretch_sessions` (`ended_at`);