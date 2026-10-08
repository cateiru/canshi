/**
 * フォームの家の選択欄（`householdId`）の値を返す。未選択なら null。
 * ユーザーがその家に所属しているかは、書き込みの文の中で確かめる（`isHouseholdMemberCondition`）
 */
export function readFormHouseholdId(formData: FormData): string | null {
  const householdId = formData.get("householdId");
  return typeof householdId === "string" && householdId !== ""
    ? householdId
    : null;
}
