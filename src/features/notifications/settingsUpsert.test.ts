// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { getDb } from "@/db/client";
import { cats, cleaningTargets, notificationSettings } from "@/db/schema";
import type { CatNotificationSettingsFormInput } from "./settingsSchema";
import { buildCatNotificationSettingsBatch } from "./settingsUpsert";

/**
 * sql.js の drizzle インスタンスは D1 専用の `db.batch` を持たないため、テストでは
 * 同じ statements を順番に実行して代替する（アトミック性以外は本番の `db.batch` と同じ
 * SQL が発行される）
 */
async function runSequentially(
  statements: ReturnType<typeof buildCatNotificationSettingsBatch>,
) {
  for (const statement of statements) {
    await statement;
  }
}

const baseFormInput: CatNotificationSettingsFormInput = {
  birthdayYearlyEnabled: true,
  birthdayHalfYearEnabled: true,
  daysMilestoneEnabled: true,
  shampooElapsedEnabled: true,
  shampooElapsedMonths: 2,
  weightMeasurementEnabled: true,
  weightMeasurementDays: 14,
};

describe("buildCatNotificationSettingsBatch", () => {
  // sql.js は D1 と同じ SQLite 方言のテスト用スタブ（`sendPush.test.ts` と同様の理由で型を合わせる）
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
    await migrate(db as unknown as ReturnType<typeof drizzle>, {
      migrationsFolder: "./drizzle",
    });
  });

  async function insertCat() {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();
    return cat;
  }

  it("初回保存では reference_id が NULL の種類ごとに1行ずつ作られる", async () => {
    const cat = await insertCat();

    await runSequentially(
      buildCatNotificationSettingsBatch(db, cat.id, [], baseFormInput),
    );

    const rows = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.catId, cat.id));
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.referenceId === null)).toBe(true);
  });

  it("同じ猫へ複数回保存しても重複行にならず、最後の値で更新される（同時保存の再現）", async () => {
    const cat = await insertCat();

    await runSequentially(
      buildCatNotificationSettingsBatch(db, cat.id, [], baseFormInput),
    );
    // 2回目の保存（別タブからの同時保存を模す）。読んでから insert/update を選ぶ方式なら
    // ここで重複行が作られうるが、onConflictDoUpdate なら既存行が更新されるだけになる
    await runSequentially(
      buildCatNotificationSettingsBatch(db, cat.id, [], {
        ...baseFormInput,
        shampooElapsedEnabled: false,
        shampooElapsedMonths: 3,
      }),
    );

    const rows = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.catId, cat.id));
    expect(rows).toHaveLength(5);
    const shampoo = rows.find((row) => row.kind === "shampoo_elapsed");
    expect(shampoo?.isEnabled).toBe(false);
    expect(shampoo?.params).toEqual({ months: 3 });
  });

  it("掃除対象ごとの設定は reference_id ごとに1行ずつ作られ、重複保存しても更新されるだけになる", async () => {
    const cat = await insertCat();
    const [target] = await db
      .insert(cleaningTargets)
      .values({ catId: cat.id, name: "トイレ", frequencyValue: 1 })
      .returning();

    await runSequentially(
      buildCatNotificationSettingsBatch(
        db,
        cat.id,
        [{ id: target.id, isEnabled: true }],
        baseFormInput,
      ),
    );
    await runSequentially(
      buildCatNotificationSettingsBatch(
        db,
        cat.id,
        [{ id: target.id, isEnabled: false }],
        baseFormInput,
      ),
    );

    const rows = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.referenceId, target.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].isEnabled).toBe(false);
  });
});
