import type { MemoLabelFormInput } from "../domain/labelSchema";
import { toMemoLabelContent } from "../domain/memoLabel";
import { createMemoLabelRepository } from "../infrastructure/memoLabelRepository";

/*
 * メモのラベルの保存・削除（ユースケース）。画面（`../presentation/labelActions.ts`）と外部接続（AI との接続・API）の
 * 両方から使う。家のメンバーであることはリポジトリの文の中で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/** 保存できなかった理由。`notFound` は、家・ラベルが見つからない（家のメンバーでない場合を含む） */
export type SaveMemoLabelFailure = "notFound" | "duplicateName";

export type SaveMemoLabelResult =
  | { id: string }
  | { failure: SaveMemoLabelFailure };

/** 家にラベルを追加する。登録後に家は変えられない */
export async function createMemoLabel(
  userId: string,
  householdId: string,
  data: MemoLabelFormInput,
  d1?: D1Database,
): Promise<SaveMemoLabelResult> {
  const repository = createMemoLabelRepository(d1);
  const content = toMemoLabelContent(data);
  const id = await repository.addForMember(userId, householdId, content);
  if (id != null) {
    return { id };
  }
  const sameName = await repository.findByNameForMember(
    userId,
    householdId,
    content.name,
  );
  return { failure: sameName ? "duplicateName" : "notFound" };
}

/**
 * ユーザーが所属する家のラベルを更新する。別の家のラベルは、存在しないラベルと区別せずに扱う
 */
export async function updateMemoLabel(
  userId: string,
  id: string,
  data: MemoLabelFormInput,
  d1?: D1Database,
): Promise<SaveMemoLabelResult> {
  const repository = createMemoLabelRepository(d1);
  if (await repository.updateForMember(userId, id, toMemoLabelContent(data))) {
    return { id };
  }
  const label = await repository.findForMember(userId, id);
  return { failure: label ? "duplicateName" : "notFound" };
}

/**
 * ユーザーが所属する家のラベルを削除する。メモに付いているラベルは削除できない（`inUse`）。
 * 別の家のラベルは、存在しないラベルと区別せずに扱う
 */
export async function deleteMemoLabel(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<"deleted" | "notFound" | "inUse"> {
  const repository = createMemoLabelRepository(d1);
  if (await repository.removeUnusedForMember(userId, id)) {
    return "deleted";
  }
  const label = await repository.findForMember(userId, id);
  return label ? "inUse" : "notFound";
}
