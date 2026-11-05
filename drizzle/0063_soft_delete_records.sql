ALTER TABLE `brushing_records` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `cleaning_records` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `expense_records` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `feeding_records` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `hospital_visits` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `medication_doses` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `medications` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `memo_records` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `poop_records` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `shampoo_records` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `symptoms` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `vomit_records` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `water_records` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `weight_records` ADD `deleted_at` integer;