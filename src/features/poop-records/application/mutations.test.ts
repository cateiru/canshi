// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, mediaAssets, poopRecords } from "@/db/schema";
import { resolveMediaRecordOwner } from "@/features/media/infrastructure/recordOwner";
import { POOP_RECORD_MEDIA_TYPE } from "../domain/media";
import type { PoopRecordFormInput } from "../domain/schema";
import {
  getPoopRecordById,
  getPoopRecordForCat,
  listPoopRecords,
} from "../infrastructure/queries";
import { deletePoopRecord, updatePoopRecord } from "./mutations";

/** 記録を操作した人（履歴の確認以外では中身を問わない） */
const actor = { userId: "user-1", mcpClientId: null };

// `src/features/households/application/management.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  // sql.js は `db.batch`（D1 専用）を持たないため、順番に実行するだけの簡易実装で補う
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = async (statements: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };
  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female" },
    { id: "kuro", name: "くろ", sex: "male" },
  ]);
  await db.insert(poopRecords).values([
    {
      id: "poop-1",
      catId: "tama",
      occurredAt: new Date("2026-07-01T08:00:00Z"),
      consistency: "normal",
    },
    {
      id: "poop-2",
      catId: "tama",
      occurredAt: new Date("2026-07-02T08:00:00Z"),
      consistency: "soft",
    },
  ]);
  await db.insert(mediaAssets).values({
    id: "poop-1-photo",
    catId: "tama",
    recordType: POOP_RECORD_MEDIA_TYPE,
    recordId: "poop-1",
    objectKey: "poop_record/poop-1/poop-1-photo",
    mimeType: "image/jpeg",
  });
});

const form: PoopRecordFormInput = {
  occurredDate: "2026-07-01",
  occurredTime: "09:00",
  consistency: "hard",
  hasBlood: false,
  hasForeignObject: false,
};

describe("deletePoopRecord", () => {
  it("記録を論理削除し、一覧・詳細から除く。添付の写真は残す", async () => {
    expect(await deletePoopRecord("tama", "poop-1", actor)).toBe(true);

    expect((await listPoopRecords("tama")).map((row) => row.id)).toEqual([
      "poop-2",
    ]);
    expect(await getPoopRecordById("poop-1")).toBeNull();
    expect(await getPoopRecordForCat("tama", "poop-1")).toBeNull();

    const [row] = await db
      .select({ deletedAt: poopRecords.deletedAt })
      .from(poopRecords)
      .where(eq(poopRecords.id, "poop-1"));
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(await db.select().from(mediaAssets)).toHaveLength(1);
    // 削除済みの記録には、新しく写真を添付できない
    expect(
      await resolveMediaRecordOwner(POOP_RECORD_MEDIA_TYPE, "poop-1"),
    ).toBeNull();
    expect(
      await resolveMediaRecordOwner(POOP_RECORD_MEDIA_TYPE, "poop-2"),
    ).toEqual({ catId: "tama" });
  });

  it("削除済みの記録は、更新・もう一度の削除ができない", async () => {
    await deletePoopRecord("tama", "poop-1", actor);

    expect(await deletePoopRecord("tama", "poop-1", actor)).toBe(false);
    expect(await updatePoopRecord("tama", "poop-1", form, actor)).toBe(false);
  });

  it("別の猫の記録は削除しない", async () => {
    expect(await deletePoopRecord("kuro", "poop-1", actor)).toBe(false);
    expect((await listPoopRecords("tama")).map((row) => row.id)).toEqual([
      "poop-2",
      "poop-1",
    ]);
  });
});
