// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { catPhotos } from "./cat-photos";
import { cats } from "./cats";
import { mediaAssets } from "./media-assets";

describe("cat_photos テーブルと cats のプロフィール画像", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("写真記録を保存し、そのメディアをプロフィール画像として参照できる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning({ id: cats.id });
    const [photo] = await db
      .insert(catPhotos)
      .values({
        catId: cat.id,
        takenAt: new Date("2026-09-01T00:00:00Z"),
        memo: "換毛期",
      })
      .returning();
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        catId: cat.id,
        recordType: "cat_photo",
        recordId: photo.id,
        objectKey: `cat_photo/${photo.id}/a`,
        mimeType: "image/jpeg",
      })
      .returning({ id: mediaAssets.id });

    await db
      .update(cats)
      .set({ profileMediaAssetId: asset.id, isProfilePinned: true })
      .where(eq(cats.id, cat.id));

    const [row] = await db.select().from(cats);
    expect(row.profileMediaAssetId).toBe(asset.id);
    expect(row.isProfilePinned).toBe(true);
    expect(photo.memo).toBe("換毛期");
    expect(photo.takenAt).toEqual(new Date("2026-09-01T00:00:00Z"));
  });

  it("既定ではプロフィール画像は未設定・固定なし", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "みけ", sex: "male" })
      .returning();
    expect(cat.profileMediaAssetId).toBeNull();
    expect(cat.isProfilePinned).toBe(false);
  });
});
