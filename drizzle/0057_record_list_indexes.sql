CREATE INDEX `cleaning_records_cleaning_target_id_performed_at_idx` ON `cleaning_records` (`cleaning_target_id`,`performed_at`);--> statement-breakpoint
CREATE INDEX `feeding_record_items_feeding_record_id_idx` ON `feeding_record_items` (`feeding_record_id`);--> statement-breakpoint
CREATE INDEX `hospital_visits_cat_id_visited_at_idx` ON `hospital_visits` (`cat_id`,`visited_at`);--> statement-breakpoint
CREATE INDEX `medication_doses_medication_id_occurred_at_idx` ON `medication_doses` (`medication_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `poop_records_cat_id_occurred_at_idx` ON `poop_records` (`cat_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `shampoo_records_cat_id_performed_at_idx` ON `shampoo_records` (`cat_id`,`performed_at`);--> statement-breakpoint
CREATE INDEX `symptoms_cat_id_onset_at_idx` ON `symptoms` (`cat_id`,`onset_at`);--> statement-breakpoint
CREATE INDEX `vomit_records_cat_id_occurred_at_idx` ON `vomit_records` (`cat_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `water_records_cat_id_occurred_at_idx` ON `water_records` (`cat_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `weight_records_cat_id_occurred_at_idx` ON `weight_records` (`cat_id`,`occurred_at`);