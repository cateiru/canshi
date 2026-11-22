/** CSV のセルの値。null・undefined は空のセルにする */
export type CsvCell = string | number | null | undefined;

/** zip に入れる CSV ファイル 1 つ分 */
export type CsvFile = {
  /** zip の中のファイル名（英数字だけ。展開する環境によらず文字化けしないようにする） */
  fileName: string;
  columns: string[];
  rows: CsvCell[][];
};

/**
 * 表計算ソフトが数式として解釈する先頭の文字（CSV インジェクション）。
 * 家のメンバーが入力した文字列のセルを開いたときに、数式として実行されないようにする
 */
const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;

/** Excel が UTF-8 と判定できるよう、先頭に付ける BOM */
const UTF8_BOM = "﻿";

function escapeCell(cell: CsvCell): string {
  if (cell == null) {
    return "";
  }
  if (typeof cell === "number") {
    return Number.isFinite(cell) ? String(cell) : "";
  }
  const text = FORMULA_PREFIX_PATTERN.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * 見出しと行から CSV の文字列を作る（RFC 4180。改行は CRLF）。Excel で開いても日本語が
 * 文字化けしないよう、先頭に BOM を付ける
 */
export function formatCsv(file: Pick<CsvFile, "columns" | "rows">): string {
  const lines = [file.columns, ...file.rows].map((row) =>
    row.map(escapeCell).join(","),
  );
  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`;
}
