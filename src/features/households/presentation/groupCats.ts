type HouseholdLike = { id: string };
type HouseholdOwnedLike = { householdId: string | null };

/**
 * 家に属するデータ（猫・ごはん商品・プリセットなど）を家ごとにまとめる。家の並びは
 * `households` の順（所属した順）のままにし、データのない家も空のまとまりとして返す。
 * 各家のデータは `items` の並び順を保つ。家に未所属のデータは含めない
 */
export function groupByHousehold<
  H extends HouseholdLike,
  T extends HouseholdOwnedLike,
>(
  households: readonly H[],
  items: readonly T[],
): { household: H; items: T[] }[] {
  const itemsByHousehold = new Map<string, T[]>();
  for (const item of items) {
    if (item.householdId == null) {
      continue;
    }
    const list = itemsByHousehold.get(item.householdId) ?? [];
    list.push(item);
    itemsByHousehold.set(item.householdId, list);
  }
  return households.map((household) => ({
    household,
    items: itemsByHousehold.get(household.id) ?? [],
  }));
}

/** 猫を所属する家ごとにまとめる（`groupByHousehold` を参照） */
export function groupCatsByHousehold<
  H extends HouseholdLike,
  C extends HouseholdOwnedLike,
>(households: readonly H[], cats: readonly C[]): { household: H; cats: C[] }[] {
  return groupByHousehold(households, cats).map(({ household, items }) => ({
    household,
    cats: items,
  }));
}
