"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";
import { requireCatAccess } from "@/features/auth/presentation/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import { userActor } from "@/features/shared/recordActor";
import {
  createFeedingRecord,
  deleteFeedingRecord,
  updateFeedingRecord,
} from "../application/mutations";
import {
  type FeedingRecordFormFieldErrors,
  type FeedingRecordItemFieldName,
  feedingRecordFormSchema,
} from "../domain/schema";

export type FeedingRecordFormState = SubmitRedirect & {
  fieldErrors?: FeedingRecordFormFieldErrors;
  formError?: string;
};

const ITEM_FIELD_PATTERN = /^items\.(\d+)\.(.+)$/;

function parseFormData(formData: FormData) {
  const indices = new Set<number>();
  for (const key of formData.keys()) {
    const match = key.match(ITEM_FIELD_PATTERN);
    if (match) {
      indices.add(Number(match[1]));
    }
  }
  const sortedIndices = Array.from(indices).sort((a, b) => a - b);

  // フォームは選択中のモードの入力欄だけを送るため、両モードの項目をまとめて
  // 読み取り、どちらを使うかはスキーマの mode による判別に任せる
  const items = sortedIndices.map((index) => ({
    foodProductId: formData.get(`items.${index}.foodProductId`),
    givenAmountG: formData.get(`items.${index}.givenAmountG`),
    leftoverAmountG: formData.get(`items.${index}.leftoverAmountG`),
    givenAmountLevel: formData.get(`items.${index}.givenAmountLevel`),
    leftoverLevel: formData.get(`items.${index}.leftoverLevel`),
  }));

  return feedingRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    mode: formData.get("mode"),
    items,
  });
}

// zod の flatten() はネストした配列パスを潰してしまい行ごとのエラーが
// 表示できなくなるため、issue.path を見て行ごとの itemErrors に振り分ける
function mapZodErrors(error: z.ZodError): FeedingRecordFormFieldErrors {
  const fieldErrors: FeedingRecordFormFieldErrors = {};
  const itemErrors: FeedingRecordFormFieldErrors["itemErrors"] = [];

  for (const issue of error.issues) {
    const [first, second, third] = issue.path;
    if (first === "items" && typeof second === "number" && third) {
      const fieldName = String(third) as FeedingRecordItemFieldName;
      itemErrors[second] ??= {};
      const rowErrors = itemErrors[second];
      rowErrors[fieldName] ??= [];
      rowErrors[fieldName].push(issue.message);
      continue;
    }
    if (
      first === "occurredDate" ||
      first === "occurredTime" ||
      first === "mode"
    ) {
      fieldErrors[first] ??= [];
      fieldErrors[first].push(issue.message);
      continue;
    }
    if (first === "items") {
      fieldErrors.items ??= [];
      fieldErrors.items.push(issue.message);
    }
  }

  if (itemErrors.some((entry) => entry != null)) {
    fieldErrors.itemErrors = itemErrors;
  }

  return fieldErrors;
}

export async function createFeedingRecordAction(
  catId: string,
  _prevState: FeedingRecordFormState,
  formData: FormData,
): Promise<FeedingRecordFormState> {
  const { user, cat } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  const saved = await createFeedingRecord(cat, parsed.data, userActor(user));
  if ("error" in saved) {
    return { formError: saved.error };
  }

  return { redirectTo: `/cats/${catId}/feeding-records` };
}

export async function updateFeedingRecordAction(
  catId: string,
  id: string,
  _prevState: FeedingRecordFormState,
  formData: FormData,
): Promise<FeedingRecordFormState> {
  const { user, cat } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  const saved = await updateFeedingRecord(
    cat,
    id,
    parsed.data,
    userActor(user),
  );
  if ("error" in saved) {
    return { formError: saved.error };
  }

  return { redirectTo: `/cats/${catId}/feeding-records` };
}

export async function deleteFeedingRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const { user } = await requireCatAccess(catId);
  await deleteFeedingRecord(catId, id, userActor(user));
  redirect(`/cats/${catId}/feeding-records`, "replace");
}
