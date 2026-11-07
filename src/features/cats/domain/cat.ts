import type { Cat, NewCat } from "@/db/schema";

/**
 * 猫（エンティティ）。家（`householdId`）に属し、記録はすべて `cat_id` で猫に紐付く。
 * 家を変えると、記録ごとその家へ引っ越す
 */
export type { Cat };

/** フォームから保存する猫の項目。`householdId` は猫を飼っている家（登録先・引っ越し先） */
export type CatValues = Pick<
  NewCat,
  | "name"
  | "sex"
  | "birthDate"
  | "birthDatePrecision"
  | "breed"
  | "adoptedAt"
  | "neuterStatus"
  | "coatColor"
  | "coatPattern"
  | "coatWhite"
> & { householdId: string };

/** 選んだ家にユーザーが所属していないときのエラー（改ざんされた値や、抜けた家が送られた場合） */
export const HOUSEHOLD_NOT_ALLOWED_ERROR = "所属している家を選択してください";
