// @vitest-environment node
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { type MediaAsset, mediaAssets, users } from "@/db/schema";

let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

// R2 を使わずに、行の削除（とアイコンの参照の解除）だけを行う。
// `failNextDelete` を立てると、次の 1 回だけ R2 の削除に失敗したものとして例外を投げる
const deletedAssetIds: string[] = [];
let failNextDelete = false;
vi.mock("@/features/media/storage", async () => {
  const { detachUserIcons } = await import("./iconImage");
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
      await detachUserIcons(ids);
      await db.delete(mediaAssets).where(inArray(mediaAssets.id, ids));
    },
  };
});

const { applyUserIconChange } = await import("./applyUserIcon");

beforeAll(async () => {
  const SQL = await initSqlJs();
  const raw = drizzle(new SQL.Database());
  await migrate(raw, { migrationsFolder: "./drizzle" });
  db = raw as unknown as ReturnType<typeof getDb>;
  // sql.js は `db.batch`（D1 専用）を持たないため、順番に実行するだけの簡易実装で補う。
  // D1 の batch は 1 トランザクションとして実行され他の batch と混ざらないため、
  // 同時に呼ばれた batch も1つずつ直列に実行する（`cats/applyProfileImage.test.ts` と同様）
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

async function createUser() {
  const [user] = await db
    .insert(users)
    .values({ name: "ユーザー" })
    .returning();
  return user;
}

async function createPendingAsset(
  uploadedByUserId: string,
  mimeType = "image/jpeg",
) {
  const id = crypto.randomUUID();
  await db.insert(mediaAssets).values({
    id,
    catId: null,
    uploadedByUserId,
    recordType: "pending",
    recordId: id,
    objectKey: `pending/${id}`,
    mimeType,
  });
  return id;
}

async function getUser(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

async function getIconAssetIds(userId: string) {
  const rows = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.recordType, "user_icon"),
        eq(mediaAssets.recordId, userId),
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

describe("applyUserIconChange", () => {
  it("keep では何も変更しない", async () => {
    const user = await createUser();
    expect(
      await applyUserIconChange(user.id, { type: "keep" }),
    ).toBeUndefined();
    expect((await getUser(user.id)).iconMediaAssetId).toBeNull();
  });

  it("下書きをユーザーのアイコンとして紐付け、差し替えると古い画像を削除する", async () => {
    const user = await createUser();
    const previousId = await createPendingAsset(user.id);
    expect(
      await applyUserIconChange(user.id, { type: "set", assetId: previousId }),
    ).toBeUndefined();

    const nextId = await createPendingAsset(user.id);
    expect(
      await applyUserIconChange(user.id, { type: "set", assetId: nextId }),
    ).toBeUndefined();

    expect((await getUser(user.id)).iconMediaAssetId).toBe(nextId);
    expect(await getAsset(nextId)).toMatchObject({
      recordType: "user_icon",
      recordId: user.id,
      catId: null,
    });
    expect(await getAsset(previousId)).toBeUndefined();
    expect(deletedAssetIds).toContain(previousId);
  });

  it("下書き以外・画像以外の asset ID は紐付けずにエラーを返す", async () => {
    const user = await createUser();
    const videoId = await createPendingAsset(user.id, "video/mp4");
    expect(
      await applyUserIconChange(user.id, { type: "set", assetId: videoId }),
    ).toMatch(/見つかりませんでした/);
    expect(
      await applyUserIconChange(user.id, { type: "set", assetId: "missing" }),
    ).toMatch(/見つかりませんでした/);
    expect((await getUser(user.id)).iconMediaAssetId).toBeNull();
    expect((await getAsset(videoId)).recordType).toBe("pending");
  });

  it("別のユーザーがアップロードした下書きは紐付けない", async () => {
    const user = await createUser();
    const other = await createUser();
    const othersDraftId = await createPendingAsset(other.id);
    expect(
      await applyUserIconChange(user.id, {
        type: "set",
        assetId: othersDraftId,
      }),
    ).toMatch(/見つかりませんでした/);
    expect((await getUser(user.id)).iconMediaAssetId).toBeNull();
    expect((await getAsset(othersDraftId)).recordType).toBe("pending");
  });

  it("他のユーザーのアイコン画像は奪えない", async () => {
    const owner = await createUser();
    const other = await createUser();
    const assetId = await createPendingAsset(owner.id);
    await applyUserIconChange(owner.id, { type: "set", assetId });

    expect(
      await applyUserIconChange(other.id, { type: "set", assetId }),
    ).toMatch(/見つかりませんでした/);
    expect((await getUser(owner.id)).iconMediaAssetId).toBe(assetId);
    expect((await getUser(other.id)).iconMediaAssetId).toBeNull();
  });

  it("remove ではアイコンを外して削除する", async () => {
    const user = await createUser();
    const assetId = await createPendingAsset(user.id);
    await applyUserIconChange(user.id, { type: "set", assetId });

    expect(
      await applyUserIconChange(user.id, { type: "remove" }),
    ).toBeUndefined();
    expect((await getUser(user.id)).iconMediaAssetId).toBeNull();
    expect(await getAsset(assetId)).toBeUndefined();
  });

  it("同時に画像を外しても、同時に設定した画像は消さない", async () => {
    const user = await createUser();
    const oldId = await createPendingAsset(user.id);
    await applyUserIconChange(user.id, { type: "set", assetId: oldId });

    const nextId = await createPendingAsset(user.id);
    await Promise.all([
      applyUserIconChange(user.id, { type: "remove" }),
      applyUserIconChange(user.id, { type: "set", assetId: nextId }),
    ]);

    const { iconMediaAssetId } = await getUser(user.id);
    expect(await getIconAssetIds(user.id)).toEqual(
      iconMediaAssetId ? [iconMediaAssetId] : [],
    );
    expect(await getAsset(oldId)).toBeUndefined();
  });

  it("古い画像の削除に失敗しても、同じ画像で保存し直すと削除をやり直す", async () => {
    const user = await createUser();
    const oldId = await createPendingAsset(user.id);
    await applyUserIconChange(user.id, { type: "set", assetId: oldId });

    const nextId = await createPendingAsset(user.id);
    failNextDelete = true;
    expect(
      await applyUserIconChange(user.id, { type: "set", assetId: nextId }),
    ).toMatch(/保存できませんでした/);
    expect((await getUser(user.id)).iconMediaAssetId).toBe(nextId);
    expect(await getAsset(oldId)).toBeDefined();

    expect(
      await applyUserIconChange(user.id, { type: "set", assetId: nextId }),
    ).toBeUndefined();
    expect(await getIconAssetIds(user.id)).toEqual([nextId]);
  });
});
