type HouseholdLike = { id: string };
type CatLike = { householdId: string | null };

/**
 * 猫を所属する家ごとにまとめる。家の並びは `households` の順（所属した順）のままにし、
 * 猫のいない家も空のまとまりとして返す。各家の猫は `cats` の並び順を保つ
 */
export function groupCatsByHousehold<
  H extends HouseholdLike,
  C extends CatLike,
>(households: readonly H[], cats: readonly C[]): { household: H; cats: C[] }[] {
  const catsByHousehold = new Map<string, C[]>();
  for (const cat of cats) {
    if (cat.householdId == null) {
      continue;
    }
    const list = catsByHousehold.get(cat.householdId) ?? [];
    list.push(cat);
    catsByHousehold.set(cat.householdId, list);
  }
  return households.map((household) => ({
    household,
    cats: catsByHousehold.get(household.id) ?? [],
  }));
}
