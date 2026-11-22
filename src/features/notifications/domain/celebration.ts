import type { NotificationKind } from "@/db/schema";

/**
 * お祝いの通知の種類（年ごとの誕生日・半年ごとの節目・生後100日ごとの節目）。
 * 後回しにしたり見送ったりする用事ではないため、通知センターでは延期・無視を出さず、
 * 完了と同じ操作の「おめでとう」だけを表示する
 */
export const CELEBRATION_NOTIFICATION_KINDS = [
  "birthday_yearly",
  "birthday_half_year",
  "days_milestone",
] as const satisfies readonly NotificationKind[];

/** お祝いの通知の種類か（`CELEBRATION_NOTIFICATION_KINDS` を参照） */
export function isCelebrationNotificationKind(kind: NotificationKind): boolean {
  return (
    CELEBRATION_NOTIFICATION_KINDS as readonly NotificationKind[]
  ).includes(kind);
}
