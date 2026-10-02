// @vitest-environment node
import { and, eq, inArray } from "drizzle-orm";
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

// R2 を使わずに、行の削除（とプロフィール画像の参照の解除）だけを行う。
// `failNextDelete` を立てると、次の 1 回だけ R2 の削除に失敗したものとして例外を投げる
const deletedAssetIds: string[] = [];
let failNextDelete = false;
vi.mock("@/features/media/storage", async () => {
  const { detachProfileImages } = await import("./profileImage");
  return {
    deleteMediaAssetRows: async (assets: MediaAsset[]) => {
      if (assets.length === 0) {
        return;
      }
      if (failNextDelete) {
        failNextDelete = false;
        throw new Error("R2 の削除に失敗しました");
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
  // sql.js は `db.batch`（D1 専用）を持たないため、順番に実行するだけの簡易実装で補う。
  // D1 の batch は 1 トランザクションとして実行され他の batch と混ざらないため、
  // 同時に呼ばれた batch も1つずつ直列に実行する（`notifications/actions.test.ts` と同様）
  let batchQueue: Promise<unknown> = Promise.resolve();
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = (statements: PromiseLike<unknown>[]) => {
    const run = batchQueue.then(async () => {
      const results: unknown[] = [];
      for (const statement of statements) {
        results.push(await statement);
      }
      return results;
    });
    batchQueue = run.catch(() => {});
    return run;
  };
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

async function getProfileAssetIds(catId: string) {
  const rows = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.catId, catId),
        eq(mediaAssets.recordType, "cat_profile"),
      ),
    );
  return rows.map((row) => row.id);
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
    // 紐付け済みの古い画像
    const previousId = await createPendingAsset();
    await db
      .update(mediaAssets)
      .set({ recordType: "cat_profile", recordId: cat.id, catId: cat.id })
      .where(eq(mediaAssets.id, previousId));
    await db
      .update(cats)
      .set({ profileMediaAssetId: previousId })
      .where(eq(cats.id, cat.id));

    const nextId = await createPendingAsset();
    expect(
      await applyProfileImageChange(cat.id, { type: "set", assetId: nextId }),
    ).toBeUndefined();

    const updated = await getCat(cat.id);
    expect(updated.profileMediaAssetId).toBe(nextId);
    expect(await getAsset(nextId)).toMatchObject({
      recordType: "cat_profile",
      recordId: cat.id,
      catId: cat.id,
    });
    expect(await getAsset(previousId)).toBeUndefined();
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

  it("同じ猫の画像を同時に更新しても、最後に反映した画像は残す", async () => {
    const cat = await createCat();
    const oldId = await createPendingAsset();
    await applyProfileImageChange(cat.id, { type: "set", assetId: oldId });

    const firstId = await createPendingAsset();
    const secondId = await createPendingAsset();
    const results = await Promise.all([
      applyProfileImageChange(cat.id, { type: "set", assetId: firstId }),
      applyProfileImageChange(cat.id, { type: "set", assetId: secondId }),
    ]);
    expect(results).toEqual([undefined, undefined]);

    const { profileMediaAssetId } = await getCat(cat.id);
    expect([firstId, secondId]).toContain(profileMediaAssetId);
    expect(await getProfileAssetIds(cat.id)).toEqual([profileMediaAssetId]);
  });

  it("同時に画像を外しても、同時に設定した画像は消さない", async () => {
    const cat = await createCat();
    const oldId = await createPendingAsset();
    await applyProfileImageChange(cat.id, { type: "set", assetId: oldId });

    const nextId = await createPendingAsset();
    await Promise.all([
      applyProfileImageChange(cat.id, { type: "remove" }),
      applyProfileImageChange(cat.id, { type: "set", assetId: nextId }),
    ]);

    const { profileMediaAssetId } = await getCat(cat.id);
    expect(await getProfileAssetIds(cat.id)).toEqual(
      profileMediaAssetId ? [profileMediaAssetId] : [],
    );
    expect(await getAsset(oldId)).toBeUndefined();
  });

  it("古い画像の削除に失敗しても、同じ画像で保存し直すと削除をやり直す", async () => {
    const cat = await createCat();
    const oldId = await createPendingAsset();
    await applyProfileImageChange(cat.id, { type: "set", assetId: oldId });

    const nextId = await createPendingAsset();
    failNextDelete = true;
    expect(
      await applyProfileImageChange(cat.id, { type: "set", assetId: nextId }),
    ).toMatch(/保存できませんでした/);
    expect((await getCat(cat.id)).profileMediaAssetId).toBe(nextId);
    expect(await getAsset(oldId)).toBeDefined();

    expect(
      await applyProfileImageChange(cat.id, { type: "set", assetId: nextId }),
    ).toBeUndefined();
    expect((await getCat(cat.id)).profileMediaAssetId).toBe(nextId);
    expect(await getProfileAssetIds(cat.id)).toEqual([nextId]);
  });

  it("紐付け済みで参照が古いままの画像でも、保存し直すと付け替える", async () => {
    const cat = await createCat();
    const oldId = await createPendingAsset();
    await applyProfileImageChange(cat.id, { type: "set", assetId: oldId });
    // 紐付けた後、猫の参照を更新する前に失敗した状態
    const nextId = await createPendingAsset();
    await db
      .update(mediaAssets)
      .set({ recordType: "cat_profile", recordId: cat.id, catId: cat.id })
      .where(eq(mediaAssets.id, nextId));

    expect(
      await applyProfileImageChange(cat.id, { type: "set", assetId: nextId }),
    ).toBeUndefined();
    expect((await getCat(cat.id)).profileMediaAssetId).toBe(nextId);
    expect(await getProfileAssetIds(cat.id)).toEqual([nextId]);
  });
});
