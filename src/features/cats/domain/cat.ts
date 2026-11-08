import type { Cat, NewCat } from "@/db/schema";

/**
 * 猫（エンティティ）。家（`householdId`）に属し、記録はすべて `cat_id` で猫に紐付く。
 * 猫を飼う家は登録するときに選び、登録した後は変えられない
 */
export type { Cat };

/** フォームから保存する猫のプロフィールの項目。猫を飼う家は含まない（登録後は変えられないため） */
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
>;

/** 猫を登録するときの項目。`householdId` は猫を飼う家（登録先） */
export type NewCatValues = CatValues & { householdId: string };

/** 選んだ家にユーザーが所属していないときのエラー（改ざんされた値や、抜けた家が送られた場合） */
export const HOUSEHOLD_NOT_ALLOWED_ERROR = "所属している家を選択してください";
