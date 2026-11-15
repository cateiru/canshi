import { z } from "zod";
import { getNaiveUtcNow, splitDateTimeUtc } from "@/features/shared/datetime";

/*
 * メモリー（思い出）。旅立った猫を、記録や通知の対象から外して思い出として残す。
 * 「死」「削除」のような強い言葉は使わず、画面・AI への説明では「メモリー」「思い出」と呼ぶ。
 *
 * メモリーへ移した猫は次のようになる。メモリーから戻すと、すべて元どおりにできる
 * （AI との接続の書き込みの許可は戻らない）。
 * - 記録の追加・編集・削除、プロフィール・通知の設定の変更ができない
 * - 通知を作らない（移したときに、まだ終わっていない通知は閉じる）
 * - タイムラインは、メモリーへ移した日のエントリを最後に、それより後を表示しない
 * - AI との接続（MCP）から書き込めない（移したときに、書き込みの許可を外す）
 */

/** メモリーへ移したかを判定するのに使う、猫の項目 */
export type MemorialCat = { memorialDate: string | null };

/** メモリーへ移した猫なら true */
export function isMemorialCat(cat: MemorialCat): boolean {
  return cat.memorialDate != null;
}

/** メモリーへ移した猫の記録・設定を変えようとしたときの文言 */
export const MEMORIAL_CAT_READ_ONLY_MESSAGE =
  "メモリーに移したねこの記録や設定は変更できません";

/**
 * 年齢・お迎えからの期間を数える基準の日時。メモリーへ移した猫はメモリーへ移した日で止め、
 * それ以外の猫は今の日時にする（`calculateAge` などの `now` に渡す）
 */
export function getAgeReferenceDate(
  cat: MemorialCat,
  now: Date = new Date(),
): Date {
  return cat.memorialDate ? new Date(`${cat.memorialDate}T00:00:00.000Z`) : now;
}

/** 日本時間の今日の日付（YYYY-MM-DD） */
function todayJst(now: Date): string {
  return splitDateTimeUtc(getNaiveUtcNow(now)).date;
}

/**
 * メモリーへ移すフォームの入力。メモリーへ移した日は、今日（日本時間）以前で、
 * 生年月日・お迎え日より前にはできない
 */
export function memorialFormSchema(
  cat: { birthDate: string | null; adoptedAt: string | null },
  now: Date = new Date(),
) {
  const today = todayJst(now);
  return z.object({
    memorialDate: z
      .string({ error: "日付を入力してください" })
      .trim()
      .min(1, "日付を入力してください")
      .pipe(
        z
          .string()
          .date("日付の形式が正しくありません")
          .refine((date) => date <= today, "今日より後の日付は選べません")
          .refine(
            (date) => cat.birthDate == null || date >= cat.birthDate,
            "生年月日より前の日付は選べません",
          )
          .refine(
            (date) => cat.adoptedAt == null || date >= cat.adoptedAt,
            "お迎え日より前の日付は選べません",
          ),
      ),
  });
}

export type MemorialFormFieldErrors = Partial<Record<"memorialDate", string[]>>;

/** メモリーへ移した日の表示（「2026年11月15日」） */
export function formatMemorialDate(memorialDate: string): string {
  const [year, month, day] = memorialDate.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}
