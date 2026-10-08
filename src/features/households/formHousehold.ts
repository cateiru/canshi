import { getHouseholdForUser } from "./queries";

/**
 * フォームの `householdId` が、ユーザーの所属する家であればその ID を返す。未選択・所属していない家なら null。
 * ごはん商品・プリセットのように、登録時に家を選んで家に属させるデータの作成に使う
 */
export async function resolveFormHouseholdId(
  userId: string,
  formData: FormData,
): Promise<string | null> {
  const householdId = formData.get("householdId");
  if (typeof householdId !== "string" || householdId === "") {
    return null;
  }
  const household = await getHouseholdForUser(userId, householdId);
  return household?.id ?? null;
}
