CREATE TABLE `votes` (
	`suggestion_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`suggestion_id`, `voter_id`),
	FOREIGN KEY (`suggestion_id`) REFERENCES `suggestions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_votes_voter_id` ON `votes` (`voter_id`);