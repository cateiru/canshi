"use server";

import type { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { HOUSEHOLD_NOT_ALLOWED_ERROR } from "@/features/cats/mutations";
import { readFormHouseholdId } from "@/features/households/formHousehold";
import type { SubmitRedirect } from "@/features/navigation/types";
import {
  createFeedingPreset,
  deleteFeedingPreset,
  FEEDING_PRESET_NOT_FOUND_ERROR,
  updateFeedingPreset,
} from "./mutations";
import {
  type FeedingPresetFormFieldErrors,
  type FeedingPresetItemFieldName,
  feedingPresetFormSchema,
} from "./schema";

export type FeedingPresetFormState = SubmitRedirect & {
  fieldErrors?: FeedingPresetFormFieldErrors & { householdId?: string[] };
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
    givenAmountLevel: formData.get(`items.${index}.givenAmountLevel`),
  }));

  return feedingPresetFormSchema.safeParse({
    name: formData.get("name"),
    mode: formData.get("mode"),
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
      const fieldName = String(third) as FeedingPresetItemFieldName;
      itemErrors[second] ??= {};
      const rowErrors = itemErrors[second];
      rowErrors[fieldName] ??= [];
      rowErrors[fieldName].push(issue.message);
      continue;
    }
    if (first === "name" || first === "mode") {
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

export async function createFeedingPresetAction(
  _prevState: FeedingPresetFormState,
  formData: FormData,
): Promise<FeedingPresetFormState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  // プリセットは登録時に選んだ家に属し、明細はその家の商品に限る。登録後に家は変えられない
  const householdId = readFormHouseholdId(formData);
  if (!householdId) {
    return { fieldErrors: { householdId: [HOUSEHOLD_NOT_ALLOWED_ERROR] } };
  }
  const saved = await createFeedingPreset(user.id, householdId, parsed.data);
  if ("householdError" in saved) {
    return { fieldErrors: { householdId: [saved.householdError] } };
  }
  if ("error" in saved) {
    return { formError: saved.error };
  }

  return { redirectTo: "/feeding-presets" };
}

export async function updateFeedingPresetAction(
  id: string,
  _prevState: FeedingPresetFormState,
  formData: FormData,
): Promise<FeedingPresetFormState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  const saved = await updateFeedingPreset(user.id, id, parsed.data);
  if ("error" in saved) {
    return { formError: saved.error };
  }

  return { redirectTo: "/feeding-presets" };
}

export type DeleteFeedingPresetResult = { error?: string };

// この Action は redirect せず、成功/失敗のどちらも戻り値で表現する。
// 呼び出し側（クライアントコンポーネント）が結果を待ち受けて画面更新を行うため
export async function deleteFeedingPresetAction(
  id: string,
): Promise<DeleteFeedingPresetResult> {
  const user = await requireUser();

  if (!(await deleteFeedingPreset(user.id, id))) {
    return { error: FEEDING_PRESET_NOT_FOUND_ERROR };
  }
  return {};
}
