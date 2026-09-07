"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { getDb } from "@/db/client";
import { feedingRecordItems, feedingRecords, foodProducts } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import {
  calculateEstimatedIntakeG,
  calculateEstimatedKcal,
} from "./calculations";
import {
  type FeedingRecordFormFieldErrors,
  feedingRecordFormSchema,
} from "./schema";

export type FeedingRecordFormState = {
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

  const items = sortedIndices.map((index) => ({
    foodProductId: formData.get(`items.${index}.foodProductId`),
    givenAmountG: formData.get(`items.${index}.givenAmountG`),
    leftoverAmountG: formData.get(`items.${index}.leftoverAmountG`),
  }));

  return feedingRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
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
      const fieldName = String(third) as
        | "foodProductId"
        | "givenAmountG"
        | "leftoverAmountG";
      itemErrors[second] ??= {};
      const rowErrors = itemErrors[second];
      rowErrors[fieldName] ??= [];
      rowErrors[fieldName].push(issue.message);
      continue;
    }
    if (first === "occurredDate" || first === "occurredTime") {
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

async function buildItemsToInsert(
  items: {
    foodProductId: string;
    givenAmountG: number;
    leftoverAmountG: number;
  }[],
) {
  const db = getDb();
  const foodProductIds = [...new Set(items.map((item) => item.foodProductId))];
  const products = await db
    .select()
    .from(foodProducts)
    .where(inArray(foodProducts.id, foodProductIds));
  const productById = new Map(products.map((product) => [product.id, product]));

  if (productById.size !== foodProductIds.length) {
    return { error: "選択された商品が見つかりませんでした" } as const;
  }

  const values = items.map((item, index) => {
    // biome-ignore lint/style/noNonNullAssertion: 上の size チェックで全件存在を確認済み
    const product = productById.get(item.foodProductId)!;
    const estimatedIntakeG = calculateEstimatedIntakeG(
      item.givenAmountG,
      item.leftoverAmountG,
    );
    return {
      foodProductId: item.foodProductId,
      givenAmountG: item.givenAmountG,
      leftoverAmountG: item.leftoverAmountG,
      estimatedIntakeG,
      estimatedKcal: calculateEstimatedKcal(
        estimatedIntakeG,
        product.kcalPer100g,
      ),
      sortOrder: index,
    };
  });

  return { values } as const;
}

export async function createFeedingRecordAction(
  catId: string,
  _prevState: FeedingRecordFormState,
  formData: FormData,
): Promise<FeedingRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  const built = await buildItemsToInsert(parsed.data.items);
  if ("error" in built) {
    return { formError: built.error };
  }

  const db = getDb();
  const feedingRecordId = crypto.randomUUID();
  const occurredAt = combineDateTimeUtc(
    parsed.data.occurredDate,
    parsed.data.occurredTime,
  );

  await db.batch([
    db.insert(feedingRecords).values({
      id: feedingRecordId,
      catId,
      occurredAt,
    }),
    db.insert(feedingRecordItems).values(
      built.values.map((value) => ({
        ...value,
        feedingRecordId,
      })),
    ),
  ]);

  redirect(`/cats/${catId}/feeding-records`);
}

export async function updateFeedingRecordAction(
  catId: string,
  id: string,
  _prevState: FeedingRecordFormState,
  formData: FormData,
): Promise<FeedingRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  const built = await buildItemsToInsert(parsed.data.items);
  if ("error" in built) {
    return { formError: built.error };
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: feedingRecords.id })
    .from(feedingRecords)
    .where(and(eq(feedingRecords.id, id), eq(feedingRecords.catId, catId)))
    .limit(1);

  if (!existing) {
    return { formError: "記録が見つかりませんでした" };
  }

  const occurredAt = combineDateTimeUtc(
    parsed.data.occurredDate,
    parsed.data.occurredTime,
  );

  await db.batch([
    db
      .update(feedingRecords)
      .set({ occurredAt, updatedAt: new Date() })
      .where(eq(feedingRecords.id, id)),
    db
      .delete(feedingRecordItems)
      .where(eq(feedingRecordItems.feedingRecordId, id)),
    db.insert(feedingRecordItems).values(
      built.values.map((value) => ({
        ...value,
        feedingRecordId: id,
      })),
    ),
  ]);

  redirect(`/cats/${catId}/feeding-records`);
}

export async function deleteFeedingRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  await db.batch([
    db
      .delete(feedingRecordItems)
      .where(eq(feedingRecordItems.feedingRecordId, id)),
    db
      .delete(feedingRecords)
      .where(and(eq(feedingRecords.id, id), eq(feedingRecords.catId, catId))),
  ]);
  redirect(`/cats/${catId}/feeding-records`);
}
