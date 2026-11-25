import type { MemoLabelColor } from "@/db/schema";

/** メモのラベルの色の表示名 */
export const MEMO_LABEL_COLOR_LABEL: Record<MemoLabelColor, string> = {
  gray: "グレー",
  red: "赤",
  orange: "オレンジ",
  yellow: "黄",
  green: "緑",
  teal: "青緑",
  blue: "青",
  purple: "紫",
  pink: "ピンク",
};

export const MEMO_LABEL_NOT_FOUND_ERROR = "ラベルが見つかりませんでした";

export const MEMO_LABEL_DUPLICATE_NAME_ERROR = "同じ名前のラベルがあります";

/** メモに付いているラベルを削除できないことの説明 */
export function memoLabelInUseMessage(memoCount?: number): string {
  return memoCount
    ? `このラベルは${memoCount}件のメモに付いているため削除できません。先にメモからラベルを外してください`
    : "このラベルはメモに付いているため削除できません。先にメモからラベルを外してください";
}
