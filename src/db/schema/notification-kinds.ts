/** 通知の種類。`notifications`・`notification_settings` の両テーブルで共有する */
export const NOTIFICATION_KINDS = [
  "birthday_yearly",
  "birthday_half_year",
  "days_milestone",
  "shampoo_elapsed",
  "weight_measurement",
  "cleaning_due",
] as const;
