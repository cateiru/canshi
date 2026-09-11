"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { shampooRecords } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import {
  type ShampooRecordFormFieldErrors,
  shampooRecordFormSchema,
} from "./schema";

export type ShampooRecordFormState = {
  fieldErrors?: ShampooRecordFormFieldErrors;
  formError?: string;
};

function parseFormData(formData: FormData) {
  return shampooRecordFormSchema.safeParse({
    performedDate: formData.get("performedDate"),
    performedTime: formData.get("performedTime"),
    memo: formData.get("memo"),
  });
}

export async function createShampooRecordAction(
  catId: string,
  _prevState: ShampooRecordFormState,
  formData: FormData,
): Promise<ShampooRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  await db.insert(shampooRecords).values({
    catId,
    performedAt: combineDateTimeUtc(
      parsed.data.performedDate,
      parsed.data.performedTime,
    ),
    memo: parsed.data.memo ?? null,
  });

  redirect(`/cats/${catId}/shampoo-records`);
}

export async function updateShampooRecordAction(
  catId: string,
  id: string,
  _prevState: ShampooRecordFormState,
  formData: FormData,
): Promise<ShampooRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(shampooRecords)
    .set({
      performedAt: combineDateTimeUtc(
        parsed.data.performedDate,
        parsed.data.performedTime,
      ),
      memo: parsed.data.memo ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(shampooRecords.id, id), eq(shampooRecords.catId, catId)))
    .returning({ id: shampooRecords.id });

  if (result.length === 0) {
    return { formError: "記録が見つかりませんでした" };
  }

  redirect(`/cats/${catId}/shampoo-records`);
}

export async function deleteShampooRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(shampooRecords)
    .where(and(eq(shampooRecords.id, id), eq(shampooRecords.catId, catId)));
  redirect(`/cats/${catId}/shampoo-records`);
}
