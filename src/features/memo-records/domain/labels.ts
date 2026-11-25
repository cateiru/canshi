export const MEMO_LABEL_NOT_FOUND_ERROR = "ラベルが見つかりませんでした";

export const MEMO_LABEL_DUPLICATE_NAME_ERROR = "同じ名前のラベルがあります";

/** メモに付いているラベルを削除できないことの説明 */
export function memoLabelInUseMessage(memoCount?: number): string {
  return memoCount
    ? `このラベルは${memoCount}件のメモに付いているため削除できません。先にメモからラベルを外してください`
    : "このラベルはメモに付いているため削除できません。先にメモからラベルを外してください";
}
