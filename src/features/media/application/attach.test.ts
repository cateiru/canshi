// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, households, mediaAssets, poopRecords, users } from "@/db/schema";
import { PENDING_MEDIA_RECORD_TYPE } from "../domain/recordTypes";
import { resolveMediaRecordOwner } from "../infrastructure/recordOwner";
import { deleteMediaAssetRows } from "../infrastructure/storage";
import { syncRecordMedia } from "./attach";

let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));
// 外された添付の削除は R2 を使うため、呼ばれたかだけを確かめる
vi.mock("../infrastructure/storage", () => ({
  deleteMediaAssetRows: vi.fn(async () => {}),
}));
vi.mock("./access", () => ({
  canAccessMediaRecordOwner: vi.fn(async () => true),
}));
// 事前の確認の後に記録が論理削除された状況を作るため、確認の結果を差し替えられるようにする
vi.mock("../infrastructure/recordOwner", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../infrastructure/recordOwner")>();
  return {
    ...actual,
    resolveMediaRecordOwner: vi.fn(actual.resolveMediaRecordOwner),
  };
});

beforeEach(async () => {
  vi.mocked(deleteMediaAssetRows).mockClear();
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  db = drizzle(sqlite) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  sqlite.run("PRAGMA foreign_keys = ON");
  await db.insert(users).values({ id: "owner", name: "オーナー" });
  await db.insert(households).values({ id: "home", name: "わが家" });
  await db
    .insert(cats)
    .values({ id: "tama", name: "たま", sex: "female", householdId: "home" });
  await db.insert(poopRecords).values({
    id: "poop",
    catId: "tama",
    occurredAt: new Date("2026-07-01T08:00:00Z"),
    consistency: "normal",
  });
  await db.insert(mediaAssets).values([
    {
      id: "attached",
      catId: "tama",
      uploadedByUserId: "owner",
      recordType: "poop_record",
      recordId: "poop",
      objectKey: "poop_record/poop/attached",
      mimeType: "image/png",
    },
    {
      id: "draft",
      uploadedByUserId: "owner",
      recordType: PENDING_MEDIA_RECORD_TYPE,
      recordId: "draft",
      objectKey: "pending/draft",
      mimeType: "image/png",
    },
  ]);
});

async function findAsset(id: string) {
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id));
  return row;
}

describe("syncRecordMedia", () => {
  it("記録が削除されていなければ下書きを紐付け、外された添付を削除する", async () => {
    const result = await syncRecordMedia(
      "poop_record",
      "poop",
      ["draft"],
      "owner",
    );

    expect(result).toEqual({});
    expect((await findAsset("draft")).recordType).toBe("poop_record");
    expect(vi.mocked(deleteMediaAssetRows)).toHaveBeenCalledWith([
      expect.objectContaining({ id: "attached" }),
    ]);
  });

  it("確認の後に記録が論理削除されたら、下書きを紐付けず、外された添付も削除しない", async () => {
    // 事前の確認では削除されていなかったことにし、その後に削除された状態で書き込ませる
    vi.mocked(resolveMediaRecordOwner).mockResolvedValueOnce({ catId: "tama" });
    await db
      .update(poopRecords)
      .set({ deletedAt: new Date("2026-07-02T00:00:00Z") })
      .where(eq(poopRecords.id, "poop"));

    const result = await syncRecordMedia(
      "poop_record",
      "poop",
      ["draft"],
      "owner",
    );

    expect(result).toEqual({ error: "添付先の記録が見つかりませんでした" });
    expect((await findAsset("draft")).recordType).toBe(
      PENDING_MEDIA_RECORD_TYPE,
    );
    expect(vi.mocked(deleteMediaAssetRows)).not.toHaveBeenCalled();
  });
});
