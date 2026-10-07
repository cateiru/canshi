import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db/client";
import { cats, householdMembers, households, users } from "@/db/schema";

/**
 * ユーザーが参照できる猫（所属する家の猫）の ID を返すサブクエリ。
 * `inArray(table.catId, accessibleCatIdsQuery(db, userId))` のように、
 * 猫に紐付くテーブルをユーザーの猫に絞り込むときに使う
 */
export function accessibleCatIdsQuery(
  db: ReturnType<typeof getDb>,
  userId: string,
) {
  return db
    .select({ id: cats.id })
    .from(cats)
    .innerJoin(
      householdMembers,
      eq(cats.householdId, householdMembers.householdId),
    )
    .where(eq(householdMembers.userId, userId));
}

/**
 * ユーザーが所属する家と、その家での権限（`role`）を所属した順に返す。今は
 * 1 ユーザー 1 家の運用だが、複数の家に所属することもスキーマ上は許容している
 */
export async function listHouseholdsForUser(userId: string, d1?: D1Database) {
  const db = getDb(d1);
  return db
    .select({
      id: households.id,
      name: households.name,
      role: householdMembers.role,
    })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(eq(householdMembers.userId, userId))
    .orderBy(asc(householdMembers.createdAt), asc(households.id));
}

/**
 * ユーザーが所属する家を、メンバーと猫の人数・頭数とあわせて所属した順に返す
 * （設定の「家の設定」の一覧に使う）
 */
export async function listHouseholdSummariesForUser(
  userId: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  return db
    .select({
      id: households.id,
      name: households.name,
      role: householdMembers.role,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM ${householdMembers} AS m
        WHERE m.household_id = ${households.id}
      )`,
      catCount: sql<number>`(
        SELECT COUNT(*) FROM ${cats} AS c
        WHERE c.household_id = ${households.id}
      )`,
    })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(eq(householdMembers.userId, userId))
    .orderBy(asc(householdMembers.createdAt), asc(households.id));
}

/** ユーザーが所属する家であれば、家とその家での権限を返す。所属していなければ null */
export async function getHouseholdForUser(
  userId: string,
  householdId: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  const [row] = await db
    .select({
      id: households.id,
      name: households.name,
      role: householdMembers.role,
    })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * 2 人のユーザーが同じ家に所属していれば true。同じユーザーどうしは、家に所属していなくても true。
 * ユーザーのアイコン画像を見せてよい相手（本人と、同じ家のメンバー）の判定に使う
 */
export async function sharesHousehold(
  userId: string,
  otherUserId: string,
  d1?: D1Database,
) {
  if (userId === otherUserId) {
    return true;
  }
  const db = getDb(d1);
  const other = alias(householdMembers, "other_members");
  const [row] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .innerJoin(other, eq(householdMembers.householdId, other.householdId))
    .where(
      and(eq(householdMembers.userId, userId), eq(other.userId, otherUserId)),
    )
    .limit(1);
  return row != null;
}

/** 家のメンバーを、オーナーを先頭に所属した順で返す */
export async function listHouseholdMembers(
  householdId: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  return db
    .select({
      userId: users.id,
      name: users.name,
      iconMediaAssetId: users.iconMediaAssetId,
      role: householdMembers.role,
      joinedAt: householdMembers.createdAt,
    })
    .from(householdMembers)
    .innerJoin(users, eq(householdMembers.userId, users.id))
    .where(eq(householdMembers.householdId, householdId))
    .orderBy(
      sql`CASE WHEN ${householdMembers.role} = 'owner' THEN 0 ELSE 1 END`,
      asc(householdMembers.createdAt),
      asc(users.id),
    );
}

/** ユーザーが参照できる猫（所属する家の猫）の一覧。新しく登録した順 */
export async function listCatsForUser(userId: string, d1?: D1Database) {
  const db = getDb(d1);
  const rows = await db
    .select({ cat: cats })
    .from(cats)
    .innerJoin(
      householdMembers,
      eq(cats.householdId, householdMembers.householdId),
    )
    .where(eq(householdMembers.userId, userId))
    .orderBy(desc(cats.createdAt));
  return rows.map((row) => row.cat);
}

/** ユーザーが参照できる猫であれば返す。存在しない・別の家の猫なら null */
export async function getCatForUser(
  userId: string,
  catId: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  const [row] = await db
    .select({ cat: cats })
    .from(cats)
    .innerJoin(
      householdMembers,
      eq(cats.householdId, householdMembers.householdId),
    )
    .where(and(eq(cats.id, catId), eq(householdMembers.userId, userId)))
    .limit(1);
  return row?.cat ?? null;
}
