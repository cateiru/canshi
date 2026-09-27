// @vitest-environment node
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, type MediaAsset, mediaAssets } from "@/db/schema";

let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

// R2 を使わずに、行の削除（とプロフィール画像の参照の解除）だけを行う
const deletedAssetIds: string[] = [];
vi.mock("@/features/media/storage", async () => {
  const { detachProfileImages } = await import("./profileImage");
  return {
    deleteMediaAssetRows: async (assets: MediaAsset[]) => {
      if (assets.length === 0) {
        return;
      }
      const ids = assets.map((asset) => asset.id);
      deletedAssetIds.push(...ids);
      await detachProfileImages(ids);
      await db.delete(mediaAssets).where(inArray(mediaAssets.id, ids));
    },
  };
});

const { applyProfileImageChange } = await import("./applyProfileImage");

beforeAll(async () => {
  const SQL = await initSqlJs();
  const raw = drizzle(new SQL.Database());
  await migrate(raw, { migrationsFolder: "./drizzle" });
  db = raw as unknown as ReturnType<typeof getDb>;
});

async function createCat() {
  const [cat] = await db
    .insert(cats)
    .values({ name: "たま", sex: "female" })
    .returning();
  return cat;
}

async function createPendingAsset(mimeType = "image/jpeg") {
  const id = crypto.randomUUID();
  await db.insert(mediaAssets).values({
    id,
    catId: null,
    recordType: "pending",
    recordId: id,
    objectKey: `pending/${id}`,
    mimeType,
  });
  return id;
}

async function getCat(id: string) {
  const [cat] = await db.select().from(cats).where(eq(cats.id, id));
  return cat;
}

async function getAsset(id: string) {
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id));
  return asset;
}

describe("applyProfileImageChange", () => {
  it("keep では何も変更しない", async () => {
    const cat = await createCat();
    expect(
      await applyProfileImageChange(cat.id, { type: "keep" }),
    ).toBeUndefined();
    expect((await getCat(cat.id)).profileMediaAssetId).toBeNull();
  });

  it("下書きを猫のプロフィール画像として紐付け、差し替えると古い画像を削除する", async () => {
    const cat = await createCat();
    // 以前の写真記録から引き継いだ画像（表示位置の値を持つ）
    const legacyId = await createPendingAsset();
    await db
      .update(mediaAssets)
      .set({ recordType: "cat_profile", recordId: cat.id, catId: cat.id })
      .where(eq(mediaAssets.id, legacyId));
    await db
      .update(cats)
      .set({ profileMediaAssetId: legacyId, profileCropX: 10 })
      .where(eq(cats.id, cat.id));

    const nextId = await createPendingAsset();
    expect(
      await applyProfileImageChange(cat.id, { type: "set", assetId: nextId }),
    ).toBeUndefined();

    const updated = await getCat(cat.id);
    expect(updated.profileMediaAssetId).toBe(nextId);
    expect(updated.profileCropX).toBeNull();
    expect(await getAsset(nextId)).toMatchObject({
      recordType: "cat_profile",
      recordId: cat.id,
      catId: cat.id,
    });
    expect(await getAsset(legacyId)).toBeUndefined();
  });

  it("下書き以外・画像以外の asset ID は紐付けずにエラーを返す", async () => {
    const cat = await createCat();
    const videoId = await createPendingAsset("video/mp4");
    expect(
      await applyProfileImageChange(cat.id, { type: "set", assetId: videoId }),
    ).toMatch(/見つかりませんでした/);
    expect(
      await applyProfileImageChange(cat.id, {
        type: "set",
        assetId: "missing",
      }),
    ).toMatch(/見つかりませんでした/);
    expect((await getCat(cat.id)).profileMediaAssetId).toBeNull();
    expect((await getAsset(videoId)).recordType).toBe("pending");
  });

  it("他の猫のプロフィール画像は奪えない", async () => {
    const owner = await createCat();
    const other = await createCat();
    const assetId = await createPendingAsset();
    await applyProfileImageChange(owner.id, { type: "set", assetId });

    expect(
      await applyProfileImageChange(other.id, { type: "set", assetId }),
    ).toMatch(/見つかりませんでした/);
    expect((await getCat(owner.id)).profileMediaAssetId).toBe(assetId);
    expect((await getCat(other.id)).profileMediaAssetId).toBeNull();
  });

  it("remove ではプロフィール画像を外して削除する", async () => {
    const cat = await createCat();
    const assetId = await createPendingAsset();
    await applyProfileImageChange(cat.id, { type: "set", assetId });

    expect(
      await applyProfileImageChange(cat.id, { type: "remove" }),
    ).toBeUndefined();
    expect((await getCat(cat.id)).profileMediaAssetId).toBeNull();
    expect(await getAsset(assetId)).toBeUndefined();
    expect(deletedAssetIds).toContain(assetId);
  });
});
