import type { MemoLabel } from "@/db/schema";
import type { MemoLabelFormInput } from "./labelSchema";

/**
 * メモに付けるラベル（エンティティ）。家（`householdId`）に属し、その家のどの猫のメモにも使い回せる。
 * 登録後に家は変えられない
 */
export type { MemoLabel };

/** ラベルの中身。ID・家・作成日時など、保存のたびに変わらない項目を除いたもの */
export type MemoLabelContent = Pick<MemoLabel, "name" | "color">;

/** 入力からラベルの中身を作る */
export function toMemoLabelContent(data: MemoLabelFormInput): MemoLabelContent {
  return { name: data.name, color: data.color };
}

/** 表示・選択に使うラベルの項目 */
export type MemoLabelView = Pick<MemoLabel, "id" | "name" | "color">;
