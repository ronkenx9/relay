CREATE TABLE `relay_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`intent_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`intent_id`) REFERENCES `relay_intents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_intent_idx` ON `relay_events` (`intent_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `relay_hops` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`source_market_id` text NOT NULL,
	`destination_market_id` text,
	`pool_address` text,
	`nonce` text,
	`transaction_hash` text,
	`order_id` text,
	`aligned_price` text,
	`aligned_quantity` text,
	`filled_quantity` text DEFAULT '0' NOT NULL,
	`remaining_quantity` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`intent_id`) REFERENCES `relay_intents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hops_intent_sequence_idx` ON `relay_hops` (`intent_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `hops_state_idx` ON `relay_hops` (`state`);--> statement-breakpoint
CREATE TABLE `relay_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`operator_id` integer NOT NULL,
	`venue_id` text NOT NULL,
	`asset` text NOT NULL,
	`interval_sec` integer NOT NULL,
	`outcome` text NOT NULL,
	`limit_price` text NOT NULL,
	`requested_quantity` text NOT NULL,
	`remaining_quantity` text NOT NULL,
	`source_market_id` text NOT NULL,
	`current_market_id` text NOT NULL,
	`rolls_used` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `intents_state_idx` ON `relay_intents` (`state`);--> statement-breakpoint
CREATE INDEX `intents_series_idx` ON `relay_intents` (`operator_id`,`venue_id`,`asset`,`interval_sec`);