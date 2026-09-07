"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { feedingRecords, foodProducts } from "@/db/schema";
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

function parseFormData(formData: FormData) {
  return feedingRecordFormSchema.safeParse({
    foodProductId: formData.get("foodProductId"),
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    givenAmountG: formData.get("givenAmountG"),
    leftoverAmountG: formData.get("leftoverAmountG"),
  });
}

export async function createFeedingRecordAction(
  catId: string,
  _prevState: FeedingRecordFormState,
  formData: FormData,
): Promise<FeedingRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const [foodProduct] = await db
    .select()
    .from(foodProducts)
    .where(eq(foodProducts.id, parsed.data.foodProductId))
    .limit(1);

  if (!foodProduct) {
    return { formError: "選択された商品が見つかりませんでした" };
  }

  const estimatedIntakeG = calculateEstimatedIntakeG(
    parsed.data.givenAmountG,
    parsed.data.leftoverAmountG,
  );
  const estimatedKcal = calculateEstimatedKcal(
    estimatedIntakeG,
    foodProduct.kcalPer100g,
  );

  await db.insert(feedingRecords).values({
    catId,
    foodProductId: parsed.data.foodProductId,
    occurredAt: combineDateTimeUtc(
      parsed.data.occurredDate,
      parsed.data.occurredTime,
    ),
    givenAmountG: parsed.data.givenAmountG,
    leftoverAmountG: parsed.data.leftoverAmountG,
    estimatedIntakeG,
    estimatedKcal,
  });

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
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const [foodProduct] = await db
    .select()
    .from(foodProducts)
    .where(eq(foodProducts.id, parsed.data.foodProductId))
    .limit(1);

  if (!foodProduct) {
    return { formError: "選択された商品が見つかりませんでした" };
  }

  const estimatedIntakeG = calculateEstimatedIntakeG(
    parsed.data.givenAmountG,
    parsed.data.leftoverAmountG,
  );
  const estimatedKcal = calculateEstimatedKcal(
    estimatedIntakeG,
    foodProduct.kcalPer100g,
  );

  const result = await db
    .update(feedingRecords)
    .set({
      foodProductId: parsed.data.foodProductId,
      occurredAt: combineDateTimeUtc(
        parsed.data.occurredDate,
        parsed.data.occurredTime,
      ),
      givenAmountG: parsed.data.givenAmountG,
      leftoverAmountG: parsed.data.leftoverAmountG,
      estimatedIntakeG,
      estimatedKcal,
      updatedAt: new Date(),
    })
    .where(eq(feedingRecords.id, id))
    .returning({ id: feedingRecords.id });

  if (result.length === 0) {
    return { formError: "記録が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/feeding-records`);
}

export async function deleteFeedingRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  await db.delete(feedingRecords).where(eq(feedingRecords.id, id));
  redirect(`/cats/${catId}/feeding-records`);
}
