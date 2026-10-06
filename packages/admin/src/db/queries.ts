/**
 * 管理画面が表示するデータを D1 から読み出すクエリ。
 *
 * メインアプリの Drizzle スキーマ（`src/db/schema`）は import しない。パッケージ境界を
 * またぐと Next.js 向けの tsconfig・パスエイリアスに連鎖的に依存してしまうため
 * （`packages/mcp-server/src/rpc/mainApp.ts` と同じ理由）、生の SQL で書く。
 * そのため、メインアプリでテーブル・列を変更したときはここも合わせて更新すること
 * （`queries.test.ts` はリポジトリルートの `drizzle/` のマイグレーションを適用した DB で
 * 実行するため、列名の食い違いはテストで検出できる）。
 *
 * 管理画面は閲覧専用のため、SELECT だけを発行する。
 */

/** このファイルのクエリが使う D1 の機能（テストで sql.js に差し替えるため最小限にする） */
export type AdminDb = Pick<D1Database, "prepare" | "batch">;

export interface Overview {
  userCount: number;
  householdCount: number;
  catCount: number;
  /** 家に所属していない猫の数。0 でなければ `household:link` の実行漏れの可能性がある */
  unassignedCatCount: number;
}

export interface UserMembership {
  householdId: string;
  householdName: string;
  role: string;
}

export interface AdminUser {
  id: string;
  name: string;
  role: string;
  createdAt: Date;
  /** 有効期限内のログインセッションの数 */
  activeSessionCount: number;
  /** 有効期限内のセッションのうち、最も遅い有効期限 */
  latestSessionExpiresAt: Date | null;
  households: UserMembership[];
}

export interface HouseholdMember {
  userId: string;
  userName: string;
  role: string;
}

export interface AdminHousehold {
  id: string;
  name: string;
  createdAt: Date;
  catCount: number;
  members: HouseholdMember[];
}

type OverviewRow = {
  user_count: number;
  household_count: number;
  cat_count: number;
  unassigned_cat_count: number;
};

type UserRow = {
  id: string;
  name: string;
  role: string;
  created_at: number;
  active_session_count: number;
  latest_session_expires_at: number | null;
};

type HouseholdRow = {
  id: string;
  name: string;
  created_at: number;
  cat_count: number;
};

type MembershipRow = {
  household_id: string;
  household_name: string;
  user_id: string;
  user_name: string;
  role: string;
};

/** D1 の `integer(..., { mode: "timestamp" })` 列（unix 秒）を Date にする */
function fromUnixSeconds(value: number) {
  return new Date(value * 1000);
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

const MEMBERSHIPS_SQL = `
SELECT
  hm.household_id,
  h.name AS household_name,
  hm.user_id,
  u.name AS user_name,
  hm.role
FROM household_members hm
JOIN households h ON h.id = hm.household_id
JOIN users u ON u.id = hm.user_id
ORDER BY hm.role = 'owner' DESC, hm.created_at, hm.user_id`;

export async function getOverview(db: AdminDb): Promise<Overview> {
  const { results } = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users) AS user_count,
        (SELECT COUNT(*) FROM households) AS household_count,
        (SELECT COUNT(*) FROM cats) AS cat_count,
        (SELECT COUNT(*) FROM cats WHERE household_id IS NULL) AS unassigned_cat_count`,
    )
    .all<OverviewRow>();
  const row = results[0];
  return {
    userCount: row.user_count,
    householdCount: row.household_count,
    catCount: row.cat_count,
    unassignedCatCount: row.unassigned_cat_count,
  };
}

/**
 * ユーザーの一覧（登録順）。セッションのトークン（ハッシュ）は表示に不要なため読み出さず、
 * 有効なセッションの数と有効期限だけを集計する
 */
export async function listUsers(
  db: AdminDb,
  now: Date = new Date(),
): Promise<AdminUser[]> {
  const [users, memberships] = await db.batch([
    db
      .prepare(
        `SELECT
          u.id,
          u.name,
          u.role,
          u.created_at,
          COUNT(s.user_id) AS active_session_count,
          MAX(s.expires_at) AS latest_session_expires_at
        FROM users u
        LEFT JOIN sessions s ON s.user_id = u.id AND s.expires_at > ?1
        GROUP BY u.id
        ORDER BY u.created_at, u.id`,
      )
      .bind(toUnixSeconds(now)),
    db.prepare(MEMBERSHIPS_SQL),
  ]);

  const householdsByUser = new Map<string, UserMembership[]>();
  for (const row of memberships.results as MembershipRow[]) {
    const list = householdsByUser.get(row.user_id) ?? [];
    list.push({
      householdId: row.household_id,
      householdName: row.household_name,
      role: row.role,
    });
    householdsByUser.set(row.user_id, list);
  }

  return (users.results as UserRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    createdAt: fromUnixSeconds(row.created_at),
    activeSessionCount: row.active_session_count,
    latestSessionExpiresAt:
      row.latest_session_expires_at === null
        ? null
        : fromUnixSeconds(row.latest_session_expires_at),
    households: householdsByUser.get(row.id) ?? [],
  }));
}

/** 家の一覧（作成順）。メンバーはオーナーを先にする */
export async function listHouseholds(db: AdminDb): Promise<AdminHousehold[]> {
  const [households, memberships] = await db.batch([
    db.prepare(
      `SELECT
        h.id,
        h.name,
        h.created_at,
        (SELECT COUNT(*) FROM cats c WHERE c.household_id = h.id) AS cat_count
      FROM households h
      ORDER BY h.created_at, h.id`,
    ),
    db.prepare(MEMBERSHIPS_SQL),
  ]);

  const membersByHousehold = new Map<string, HouseholdMember[]>();
  for (const row of memberships.results as MembershipRow[]) {
    const list = membersByHousehold.get(row.household_id) ?? [];
    list.push({ userId: row.user_id, userName: row.user_name, role: row.role });
    membersByHousehold.set(row.household_id, list);
  }

  return (households.results as HouseholdRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: fromUnixSeconds(row.created_at),
    catCount: row.cat_count,
    members: membersByHousehold.get(row.id) ?? [],
  }));
}
