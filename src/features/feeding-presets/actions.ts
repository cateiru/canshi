"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { getDb } from "@/db/client";
import { feedingPresetItems, feedingPresets } from "@/db/schema";
import {
  type FeedingPresetFormFieldErrors,
  feedingPresetFormSchema,
} from "./schema";

export type FeedingPresetFormState = {
  fieldErrors?: FeedingPresetFormFieldErrors;
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

  const items = sortedIndices.map((index) => ({
    foodProductId: formData.get(`items.${index}.foodProductId`),
    givenAmountG: formData.get(`items.${index}.givenAmountG`),
  }));

  return feedingPresetFormSchema.safeParse({
    name: formData.get("name"),
    items,
  });
}

// zod の flatten() はネストした配列パスを潰してしまい行ごとのエラーが
// 表示できなくなるため、issue.path を見て行ごとの itemErrors に振り分ける
function mapZodErrors(error: z.ZodError): FeedingPresetFormFieldErrors {
  const fieldErrors: FeedingPresetFormFieldErrors = {};
  const itemErrors: FeedingPresetFormFieldErrors["itemErrors"] = [];

  for (const issue of error.issues) {
    const [first, second, third] = issue.path;
    if (first === "items" && typeof second === "number" && third) {
      const fieldName = String(third) as "foodProductId" | "givenAmountG";
      itemErrors[second] ??= {};
      const rowErrors = itemErrors[second];
      rowErrors[fieldName] ??= [];
      rowErrors[fieldName].push(issue.message);
      continue;
    }
    if (first === "name") {
      fieldErrors.name ??= [];
      fieldErrors.name.push(issue.message);
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

export async function createFeedingPresetAction(
  _prevState: FeedingPresetFormState,
  formData: FormData,
): Promise<FeedingPresetFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  const db = getDb();
  const presetId = crypto.randomUUID();

  await db.batch([
    db.insert(feedingPresets).values({ id: presetId, name: parsed.data.name }),
    db.insert(feedingPresetItems).values(
      parsed.data.items.map((item, index) => ({
        presetId,
        foodProductId: item.foodProductId,
        givenAmountG: item.givenAmountG,
        sortOrder: index,
      })),
    ),
  ]);

  redirect("/feeding-presets");
}

export async function updateFeedingPresetAction(
  id: string,
  _prevState: FeedingPresetFormState,
  formData: FormData,
): Promise<FeedingPresetFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: feedingPresets.id })
    .from(feedingPresets)
    .where(eq(feedingPresets.id, id))
    .limit(1);

  if (!existing) {
    return { formError: "プリセットが見つかりませんでした" };
  }

  await db.batch([
    db
      .update(feedingPresets)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(feedingPresets.id, id)),
    db.delete(feedingPresetItems).where(eq(feedingPresetItems.presetId, id)),
    db.insert(feedingPresetItems).values(
      parsed.data.items.map((item, index) => ({
        presetId: id,
        foodProductId: item.foodProductId,
        givenAmountG: item.givenAmountG,
        sortOrder: index,
      })),
    ),
  ]);

  redirect("/feeding-presets");
}

export type DeleteFeedingPresetResult = { error?: string };

// この Action は redirect せず、成功/失敗のどちらも戻り値で表現する。
// 呼び出し側（クライアントコンポーネント）が結果を待ち受けて画面更新を行うため
export async function deleteFeedingPresetAction(
  id: string,
): Promise<DeleteFeedingPresetResult> {
  const db = getDb();
  await db.batch([
    db.delete(feedingPresetItems).where(eq(feedingPresetItems.presetId, id)),
    db.delete(feedingPresets).where(eq(feedingPresets.id, id)),
  ]);
  return {};
}
