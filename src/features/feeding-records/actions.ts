"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { getDb } from "@/db/client";
import { feedingRecordItems, feedingRecords } from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import { createFeedingRecord, updateFeedingRecord } from "./mutations";
import {
  type FeedingRecordFormFieldErrors,
  type FeedingRecordItemFieldName,
  feedingRecordFormSchema,
} from "./schema";

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
  const { cat } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  const saved = await createFeedingRecord(cat, parsed.data);
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
  const { cat } = await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  const saved = await updateFeedingRecord(cat, id, parsed.data);
  if ("error" in saved) {
    return { formError: saved.error };
  }

  return { redirectTo: `/cats/${catId}/feeding-records` };
}

export async function deleteFeedingRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  const db = getDb();
  // 明細は記録 ID で紐付くため、この猫の記録の明細だけを消すよう親の記録で絞り込む。
  // 絞り込まないと、自分の猫の catId と別の家の記録 ID を渡して明細だけを消せてしまう
  await db.batch([
    db.delete(feedingRecordItems).where(
      inArray(
        feedingRecordItems.feedingRecordId,
        db
          .select({ id: feedingRecords.id })
          .from(feedingRecords)
          .where(
            and(eq(feedingRecords.id, id), eq(feedingRecords.catId, catId)),
          ),
      ),
    ),
    db
      .delete(feedingRecords)
      .where(and(eq(feedingRecords.id, id), eq(feedingRecords.catId, catId))),
  ]);
  redirect(`/cats/${catId}/feeding-records`, "replace");
}
