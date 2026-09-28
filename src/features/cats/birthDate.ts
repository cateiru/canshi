import type { BirthDatePrecision } from "./schema";

/**
 * 生年月日を、わかっている範囲に合わせて表示用の文字列にする。
 * 年のみ・年月のみの場合は、補完した月・日を表示しない（例: 「2020年」「2020年4月」）
 */
export function formatBirthDate(
  birthDate: string,
  precision: BirthDatePrecision,
): string {
  const [year, month] = birthDate.split("-").map(Number);
  if (precision === "year") {
    return `${year}年`;
  }
  if (precision === "month") {
    return `${year}年${month}月`;
  }
  return birthDate;
}

export type BirthDateFormDefaults = {
  birthDate: string;
  birthYear: string;
  birthMonth: string | null;
};

/**
 * 保存済みの生年月日を、フォームの各入力欄の初期値に分解する。
 * 年のみ・年月のみで登録した猫を編集したときに、補完した月・日を入力済みとして扱わないよう、
 * わかっている範囲の値だけを返す
 */
export function toBirthDateFormDefaults(
  birthDate: string | null,
  precision: BirthDatePrecision,
): BirthDateFormDefaults {
  if (!birthDate) {
    return { birthDate: "", birthYear: "", birthMonth: null };
  }
  const [year, month] = birthDate.split("-");
  return {
    birthDate: precision === "day" ? birthDate : "",
    birthYear: year,
    birthMonth: precision === "year" ? null : String(Number(month)),
  };
}

/**
 * 入力エラーで戻したときに送信していた生年月日の入力値。
 * 表示していなかった入力欄は送信されないため、その項目は `undefined` になる
 */
export type SubmittedBirthDate = {
  precision?: BirthDatePrecision;
  birthDate?: string;
  birthYear?: string;
  birthMonth?: string;
};

/**
 * 入力エラーで戻したときに、送信した値を入力欄の初期値にする。
 * 送信されなかった入力欄は、保存済みの値から作った初期値のままにする
 */
export function withSubmittedBirthDate(
  defaults: BirthDateFormDefaults,
  submitted: SubmittedBirthDate,
): BirthDateFormDefaults {
  return {
    birthDate: submitted.birthDate ?? defaults.birthDate,
    birthYear: submitted.birthYear ?? defaults.birthYear,
    // 月を選ばずに送信した場合は空文字が届くため、未選択として扱う
    birthMonth:
      submitted.birthMonth === undefined
        ? defaults.birthMonth
        : submitted.birthMonth || null,
  };
}
