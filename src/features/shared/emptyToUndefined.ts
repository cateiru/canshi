/**
 * FormData 由来の値を zod で扱う際、未送信（null。DOM に存在しない条件付き入力など）と
 * 空文字の両方を「未入力」として `undefined` に正規化する。
 */
export const emptyToUndefined = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;
