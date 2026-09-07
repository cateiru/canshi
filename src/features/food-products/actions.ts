"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { foodProducts } from "@/db/schema";
import {
  type FoodProductFormFieldErrors,
  foodProductFormSchema,
} from "./schema";

export type FoodProductFormState = {
  fieldErrors?: FoodProductFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return foodProductFormSchema.safeParse({
    name: formData.get("name"),
    kcalPer100g: formData.get("kcalPer100g"),
    packageAmountG: formData.get("packageAmountG"),
    nutritionType: formData.get("nutritionType"),
    textureType: formData.get("textureType"),
  });
}

export async function createFoodProductAction(
  _prevState: FoodProductFormState,
  formData: FormData,
): Promise<FoodProductFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  await db.insert(foodProducts).values(parsed.data);

  redirect("/food-products");
}

export async function updateFoodProductAction(
  id: string,
  _prevState: FoodProductFormState,
  formData: FormData,
): Promise<FoodProductFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(foodProducts)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(foodProducts.id, id))
    .returning({ id: foodProducts.id });

  if (result.length === 0) {
    return { formError: "商品が見つかりませんでした" };
  }

  redirect("/food-products");
}

export async function deleteFoodProductAction(id: string): Promise<void> {
  const db = getDb();
  await db.delete(foodProducts).where(eq(foodProducts.id, id));
  redirect("/food-products");
}
