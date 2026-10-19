import type { z } from "zod";
import { getNaiveUtcNow, splitDateTimeUtc } from "@/features/shared/datetime";

/**
 * AI との接続（MCP）の書き込みツールの引数を、画面のフォームと同じ zod スキーマで
 * 検証するための変換。フォームの値（FormData から読む値）と同じ形に直してから検証するため、
 * 文字数・範囲などの制限は画面から保存するときと変わらない。
 */

/** フォームの値。FormData から読む値と同じく、未入力は空文字、チェックを外したものは null */
export type FormValues = Record<string, unknown>;

/**
 * 引数の値をフォームの値に直す。真偽値はチェックボックス（`checkboxBooleanSchema`）と
 * 同じく `"on"` か null に、null は空文字（未入力）にする。数値・文字列・配列はそのまま
 * （数値はスキーマの `z.coerce` が受け付ける）
 */
export function toFormValue(value: unknown): unknown {
  if (value === null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "on" : null;
  }
  return value;
}

/** 既存の真偽値をチェックボックスの値に直す */
export function toCheckboxValue(value: boolean): "on" | null {
  return value ? "on" : null;
}

/** 既存の任意項目（null は未入力）をフォームの値に直す */
export function toOptionalValue(value: string | number | null): string {
  return value == null ? "" : String(value);
}

/**
 * 元の値（追加なら既定値、編集なら既存の記録の値）に、引数で指定された項目だけを上書きする。
 * 省略した項目（undefined）は元の値のまま
 */
export function mergeFormValues(
  base: FormValues,
  args: Record<string, unknown>,
): FormValues {
  const merged = { ...base };
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) {
      merged[key] = toFormValue(value);
    }
  }
  return merged;
}

/**
 * 記録の日付・時刻の既定値。記録の日時は日本時間の時計の数字をそのまま UTC として
 * 保存する（`combineDateTimeUtc`）ため、現在時刻も同じ見た目にして分ける
 */
export function nowDateTimeValues(
  dateKey: string,
  timeKey: string,
  now: Date = new Date(),
): FormValues {
  const { date, time } = splitDateTimeUtc(getNaiveUtcNow(now));
  return { [dateKey]: date, [timeKey]: time };
}

/** 保存済みの日時を、フォームの日付・時刻の値に分ける */
export function dateTimeValues(
  dateKey: string,
  timeKey: string,
  value: Date,
): FormValues {
  const { date, time } = splitDateTimeUtc(value);
  return { [dateKey]: date, [timeKey]: time };
}

/** フォームのスキーマで検証し、失敗したら AI に返すメッセージにまとめる */
export function parseFormValues<T extends z.ZodType>(
  schema: T,
  values: FormValues,
): { data: z.output<T> } | { error: string } {
  const parsed = schema.safeParse(values);
  if (parsed.success) {
    return { data: parsed.data };
  }
  return { error: formatZodError(parsed.error) };
}

function formatZodError(error: z.ZodError) {
  const messages = error.issues.map((issue) =>
    issue.path.length > 0
      ? `${issue.path.join(".")}: ${issue.message}`
      : issue.message,
  );
  return `入力が正しくありません。${[...new Set(messages)].join(" / ")}`;
}
