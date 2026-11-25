"use server";

import {
  requireHouseholdAccess,
  requireUser,
} from "@/features/auth/presentation/session";
import {
  createMemoLabel,
  deleteMemoLabel,
  updateMemoLabel,
} from "../application/labelMutations";
import {
  type MemoLabelFormFieldErrors,
  type MemoLabelFormInput,
  memoLabelFormSchema,
} from "../domain/labelSchema";
import {
  MEMO_LABEL_DUPLICATE_NAME_ERROR,
  MEMO_LABEL_NOT_FOUND_ERROR,
  memoLabelInUseMessage,
} from "../domain/labels";
import type { MemoLabelView } from "../domain/memoLabel";

/*
 * メモのラベルの Server Action。モーダルの中から呼び、結果を戻り値で返す（リダイレクトしない）。
 * 画面の取り直しは呼び出し側（クライアント）が行う
 */

export type SaveMemoLabelActionResult =
  | { label: MemoLabelView }
  | { fieldErrors: MemoLabelFormFieldErrors }
  | { formError: string };

/** 家にラベルを追加する */
export async function createMemoLabelAction(
  householdId: string,
  input: MemoLabelFormInput,
): Promise<SaveMemoLabelActionResult> {
  const { user } = await requireHouseholdAccess(householdId);
  const parsed = memoLabelFormSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const saved = await createMemoLabel(user.id, householdId, parsed.data);
  if ("failure" in saved) {
    return saved.failure === "duplicateName"
      ? { fieldErrors: { name: [MEMO_LABEL_DUPLICATE_NAME_ERROR] } }
      : { formError: "ラベルを追加できませんでした" };
  }
  return { label: { id: saved.id, ...parsed.data } };
}

/** ユーザーが所属する家のラベルを編集する */
export async function updateMemoLabelAction(
  labelId: string,
  input: MemoLabelFormInput,
): Promise<SaveMemoLabelActionResult> {
  const user = await requireUser();
  const parsed = memoLabelFormSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const saved = await updateMemoLabel(user.id, labelId, parsed.data);
  if ("failure" in saved) {
    return saved.failure === "duplicateName"
      ? { fieldErrors: { name: [MEMO_LABEL_DUPLICATE_NAME_ERROR] } }
      : { formError: MEMO_LABEL_NOT_FOUND_ERROR };
  }
  return { label: { id: saved.id, ...parsed.data } };
}

export type DeleteMemoLabelActionResult = { error?: string };

/**
 * ユーザーが所属する家のラベルを削除する。一覧でも削除できないことを先に表示しているが、
 * 一覧を開いた後にメモに付けられた場合に備えて、ここでも断る
 */
export async function deleteMemoLabelAction(
  labelId: string,
): Promise<DeleteMemoLabelActionResult> {
  const user = await requireUser();
  switch (await deleteMemoLabel(user.id, labelId)) {
    case "deleted":
      return {};
    case "inUse":
      return { error: memoLabelInUseMessage() };
    case "notFound":
      return { error: MEMO_LABEL_NOT_FOUND_ERROR };
  }
}
