// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import type { getDb } from "@/db/client";
import { notifications } from "@/db/schema";
import {
  ACCESSIBLE_NOTIFICATIONS_CONDITION_PARAMETERS,
  accessibleNotificationsCondition,
} from "./access";

describe("accessibleNotificationsCondition", () => {
  it("使うバインドパラメーターの数が、分割のために予約する数と一致する", async () => {
    // D1 の上限（100 個）は sql.js のテストでは超えても失敗しないため、数そのものを確かめる
    const SQL = await initSqlJs();
    const db = drizzle(new SQL.Database()) as unknown as ReturnType<
      typeof getDb
    >;
    const { params } = db
      .select()
      .from(notifications)
      .where(accessibleNotificationsCondition(db, "user-1"))
      .toSQL();
    expect(params).toHaveLength(ACCESSIBLE_NOTIFICATIONS_CONDITION_PARAMETERS);
  });
});
