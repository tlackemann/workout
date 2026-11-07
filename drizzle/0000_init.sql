CREATE TABLE `exercise_prefs` (
	`exercise_id` text PRIMARY KEY NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`banned` integer DEFAULT false NOT NULL,
	`start_load` real,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`status` text NOT NULL,
	`length` text NOT NULL,
	`seed` integer NOT NULL,
	`plan_json` text NOT NULL,
	`state_json` text,
	`state_rev` integer DEFAULT 0 NOT NULL,
	`schema_version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer
);
--> statement-breakpoint
CREATE INDEX `sessions_status_idx` ON `sessions` (`status`);--> statement-breakpoint
CREATE INDEX `sessions_day_idx` ON `sessions` (`day`,`created_at`);--> statement-breakpoint
CREATE TABLE `set_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	`set_index` integer NOT NULL,
	`exercise_id` text NOT NULL,
	`kind` text NOT NULL,
	`reps` integer NOT NULL,
	`load` real NOT NULL,
	`target_reps` integer NOT NULL,
	`target_load` real NOT NULL,
	`rep_min` integer NOT NULL,
	`rep_max` integer NOT NULL,
	`planned_sets` integer NOT NULL,
	`logged_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `set_logs_unique` ON `set_logs` (`session_id`,`position`,`set_index`);--> statement-breakpoint
CREATE INDEX `set_logs_exercise_idx` ON `set_logs` (`exercise_id`,`logged_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`json` text NOT NULL,
	`updated_at` integer NOT NULL
);
