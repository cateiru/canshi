/**
 * 通知の生成時刻（HH:MM）とタイムゾーン。以前は `notification_preferences` で変更できたが、
 * 18:00（日本時間）固定とした。掃除対象ごとに通知時刻を指定した場合は、その対象だけ
 * `cleaning_targets.notify_time` の時刻で通知する
 */
export const NOTIFY_TIME = "18:00";
export const NOTIFY_TIMEZONE = "Asia/Tokyo";

/** `notification_settings` の行が無い場合の既定値 */
export const DEFAULT_SHAMPOO_ELAPSED_MONTHS = 2;
export const DEFAULT_WEIGHT_MEASUREMENT_DAYS = 14;
