/** 通知の種類。`notifications`・`notification_settings` の両テーブルで共有する */
export const NOTIFICATION_KINDS = [
  "birthday_yearly",
  "birthday_half_year",
  "days_milestone",
  "shampoo_elapsed",
  "weight_measurement",
  "cleaning_due",
  "symptom_ongoing",
  "feeding_time",
  "feeding_not_recorded",
  "catalog_request_completed",
] as const;
