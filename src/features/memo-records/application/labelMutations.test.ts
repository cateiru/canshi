// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  householdMembers,
  households,
  memoLabels,
  memoRecordLabels,
  memoRecords,
  users,
} from "@/db/schema";
import {
  listMemoLabels,
  listMemoLabelsByRecordIds,
  listMemoLabelsUsedByCat,
  listMemoLabelsWithCount,
} from "../infrastructure/labelQueries";
import { createMemoLabelRepository } from "../infrastructure/memoLabelRepository";
import { listMemoRecords } from "../infrastructure/queries";
import {
  createMemoLabel,
  deleteMemoLabel,
  updateMemoLabel,
} from "./labelMutations";
import { createMemoRecord, updateMemoRecord } from "./mutations";

// `src/features/households/application/management.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const actor = { userId: "owner", mcpClientId: null, apiTokenId: null };
const tama = { id: "tama", householdId: "home" };

beforeEach(async () => {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  db = drizzle(sqlite) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  // D1 と同じく外部キー制約を有効にし、参照されたままのラベルを消すと失敗させる
  sqlite.run("PRAGMA foreign_keys = ON");
  // sql.js は `db.batch`（D1 専用）を持たないため、順番に実行するだけの簡易実装で補う
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = async (statements: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };
  await db.insert(users).values([
    { id: "owner", name: "わが家の人" },
    { id: "stranger", name: "別の家の人" },
  ]);
  await db.insert(households).values([
    { id: "home", name: "わが家" },
    { id: "other", name: "別の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "home", userId: "owner", role: "owner" },
    { householdId: "other", userId: "stranger", role: "owner" },
  ]);
  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female", householdId: "home" },
    { id: "kuro", name: "くろ", sex: "male", householdId: "home" },
  ]);
  await db.insert(memoLabels).values([
    {
      id: "care",
      householdId: "home",
      name: "お手入れ",
      createdAt: new Date("2026-11-01T00:00:00Z"),
    },
    {
      id: "hospital",
      householdId: "home",
      name: "病院",
      createdAt: new Date("2026-11-02T00:00:00Z"),
    },
    { id: "other-label", householdId: "other", name: "別の家" },
  ]);
});

function memoInput(labelIds: string[], labelNames: string[] = []) {
  return {
    content: "メモ",
    labelIds,
    labelNames,
    recordedDate: null,
    recordedTime: null,
  };
}

async function addMemo(labelIds: string[], cat = tama) {
  const saved = await createMemoRecord(cat, memoInput(labelIds), actor);
  if (!("id" in saved)) throw new Error("メモを追加できなかった");
  return saved.id;
}

async function labelIdsOf(memoRecordId: string) {
  const labels = await listMemoLabelsByRecordIds([memoRecordId]);
  return (labels.get(memoRecordId) ?? []).map(({ id }) => id);
}

describe("ラベルの追加", () => {
  it("家のメンバーがラベルを追加できる", async () => {
    const saved = await createMemoLabel("owner", "home", {
      name: "性格",
    });

    expect(saved).toEqual({ id: expect.any(String) });
    expect((await listMemoLabels("home")).map(({ name }) => name)).toEqual([
      "お手入れ",
      "病院",
      "性格",
    ]);
  });

  it("同じ家に同じ名前のラベルは追加できない。別の家のラベルとは重なってよい", async () => {
    expect(await createMemoLabel("owner", "home", { name: "病院" })).toEqual({
      failure: "duplicateName",
    });
    expect(await createMemoLabel("owner", "home", { name: "別の家" })).toEqual({
      id: expect.any(String),
    });
  });

  it("メンバーでない家には追加できず、同じ名前のラベルがあるかもわからない", async () => {
    for (const name of ["性格", "別の家"]) {
      expect(await createMemoLabel("owner", "other", { name })).toEqual({
        failure: "notFound",
      });
    }
    expect(await listMemoLabels("other")).toHaveLength(1);
  });
});

describe("ラベルの編集", () => {
  it("名前を変えられる（今と同じ名前でも保存できる）", async () => {
    expect(await updateMemoLabel("owner", "care", { name: "ケア" })).toEqual({
      id: "care",
    });
    expect(await updateMemoLabel("owner", "care", { name: "ケア" })).toEqual({
      id: "care",
    });
    expect((await listMemoLabels("home"))[0]).toEqual({
      id: "care",
      name: "ケア",
    });
  });

  it("同じ家の別のラベルと同じ名前にはできない", async () => {
    expect(await updateMemoLabel("owner", "care", { name: "病院" })).toEqual({
      failure: "duplicateName",
    });
    expect((await listMemoLabels("home"))[0].name).toBe("お手入れ");
  });

  it("メンバーでない家のラベルは、存在しないラベルと区別せずに断る", async () => {
    for (const id of ["other-label", "unknown"]) {
      expect(await updateMemoLabel("owner", id, { name: "変更" })).toEqual({
        failure: "notFound",
      });
    }
    expect((await listMemoLabels("other"))[0].name).toBe("別の家");
  });
});

describe("ラベルの削除", () => {
  it("メモに付いていないラベルを削除できる", async () => {
    await addMemo(["hospital"]);

    expect(await deleteMemoLabel("owner", "care")).toBe("deleted");
    expect((await listMemoLabels("home")).map(({ id }) => id)).toEqual([
      "hospital",
    ]);
  });

  it("メモに付いているラベルは削除できない。外すと削除できる", async () => {
    const id = await addMemo(["care"]);

    expect(await deleteMemoLabel("owner", "care")).toBe("inUse");
    expect(await labelIdsOf(id)).toEqual(["care"]);

    await updateMemoRecord(tama, id, memoInput([]), actor);
    expect(await deleteMemoLabel("owner", "care")).toBe("deleted");
  });

  it("削除したメモにだけ付いているラベルは、紐付けごと削除できる", async () => {
    const deletedId = await addMemo(["care", "hospital"]);
    await db
      .update(memoRecords)
      .set({ deletedAt: new Date() })
      .where(eq(memoRecords.id, deletedId));

    expect(await deleteMemoLabel("owner", "care")).toBe("deleted");
    // ほかのラベルの紐付けは残す
    expect(await db.select().from(memoRecordLabels)).toEqual([
      { memoRecordId: deletedId, memoLabelId: "hospital" },
    ]);
  });

  it("削除していないメモにも付いているラベルは、削除したメモの紐付けも残す", async () => {
    const deletedId = await addMemo(["care"]);
    await addMemo(["care"], { id: "kuro", householdId: "home" });
    await db
      .update(memoRecords)
      .set({ deletedAt: new Date() })
      .where(eq(memoRecords.id, deletedId));

    expect(await deleteMemoLabel("owner", "care")).toBe("inUse");
    expect(await db.select().from(memoRecordLabels)).toHaveLength(2);
  });

  it("メンバーでない家のラベルは、付いているかにかかわらず削除できない", async () => {
    const id = await addMemo(["care"]);
    await db
      .update(memoRecords)
      .set({ deletedAt: new Date() })
      .where(eq(memoRecords.id, id));

    expect(await deleteMemoLabel("stranger", "care")).toBe("notFound");
    expect(
      await createMemoLabelRepository().removeUnusedForMember(
        "stranger",
        "care",
      ),
    ).toBe(false);
    expect(await db.select().from(memoRecordLabels)).toHaveLength(1);
    expect(await listMemoLabels("home")).toHaveLength(2);
  });
});

describe("メモに付けるラベル", () => {
  it("追加・編集したメモのラベルを、選んだものに置き換える", async () => {
    const id = await addMemo(["hospital", "care"]);
    expect(await labelIdsOf(id)).toEqual(["care", "hospital"]);

    await updateMemoRecord(tama, id, memoInput(["hospital"]), actor);
    expect(await labelIdsOf(id)).toEqual(["hospital"]);
  });

  it("名前で指定したラベルは、家にあるものを使い、なければ作って付ける", async () => {
    const saved = await createMemoRecord(
      tama,
      memoInput([], ["病院", "性格", "別の家"]),
      actor,
    );
    if (!("id" in saved)) throw new Error("メモを追加できなかった");

    // 「別の家」は別の家のラベルの名前だが、その家のラベルは使わない
    const labels = await listMemoLabels("home");
    expect(labels.map(({ name }) => name).sort()).toEqual(
      ["お手入れ", "病院", "性格", "別の家"].sort(),
    );
    expect(await labelIdsOf(saved.id)).not.toContain("other-label");
    const names = (await listMemoLabelsByRecordIds([saved.id]))
      .get(saved.id)
      ?.map(({ name }) => name);
    expect(names?.sort()).toEqual(["病院", "性格", "別の家"].sort());

    // 編集でも同じように作り、同じ名前のラベルは増やさない
    await updateMemoRecord(
      tama,
      saved.id,
      memoInput(["care"], ["性格", "大事"]),
      actor,
    );
    expect(
      (await listMemoLabelsByRecordIds([saved.id]))
        .get(saved.id)
        ?.map(({ name }) => name)
        .sort(),
    ).toEqual(["お手入れ", "性格", "大事"].sort());
    expect(await listMemoLabels("home")).toHaveLength(5);
  });

  it("メモを保存できなかったときは、名前で指定したラベルも作らない", async () => {
    const id = await addMemo([]);
    expect(
      await updateMemoRecord(
        { id: "kuro", householdId: "home" },
        id,
        memoInput([], ["性格"]),
        actor,
      ),
    ).toEqual({ failure: "rejected" });
    await db
      .update(cats)
      .set({ memorialDate: "2026-11-20" })
      .where(eq(cats.id, "tama"));
    for (const save of [
      createMemoRecord(tama, memoInput([], ["性格"]), actor),
      updateMemoRecord(tama, id, memoInput([], ["性格"]), actor),
    ]) {
      expect(await save).toEqual({ failure: "rejected" });
    }

    expect(await listMemoLabels("home")).toHaveLength(2);
  });

  it("別の家のラベル・存在しないラベルは付けられず、メモも保存しない", async () => {
    for (const labelId of ["other-label", "unknown"]) {
      expect(
        await createMemoRecord(tama, memoInput(["care", labelId]), actor),
      ).toEqual({ failure: "labelNotFound" });
    }
    expect(await db.select().from(memoRecords)).toEqual([]);

    const id = await addMemo(["care"]);
    expect(
      await updateMemoRecord(tama, id, memoInput(["other-label"]), actor),
    ).toEqual({ failure: "labelNotFound" });
    expect(await labelIdsOf(id)).toEqual(["care"]);
  });

  it("確認の後に猫がメモリーへ移されたメモは、ラベルも変えない", async () => {
    const id = await addMemo(["care"]);
    await db
      .update(cats)
      .set({ memorialDate: "2026-11-20" })
      .where(eq(cats.id, "tama"));

    expect(
      await updateMemoRecord(tama, id, memoInput(["hospital"]), actor),
    ).toEqual({ failure: "rejected" });
    expect(await labelIdsOf(id)).toEqual(["care"]);
    expect(
      await createMemoRecord(tama, memoInput(["hospital"]), actor),
    ).toEqual({ failure: "rejected" });
    expect(await db.select().from(memoRecordLabels)).toHaveLength(1);
  });

  it("別の猫のメモのラベルは変えない", async () => {
    const id = await addMemo(["care"]);

    expect(
      await updateMemoRecord(
        { id: "kuro", householdId: "home" },
        id,
        memoInput(["hospital"]),
        actor,
      ),
    ).toEqual({ failure: "rejected" });
    expect(await labelIdsOf(id)).toEqual(["care"]);
  });
});

describe("ラベルの読み取り", () => {
  it("ラベルで絞り込んだメモと、猫のメモに付いているラベル・付いているメモの数を返す", async () => {
    const careId = await addMemo(["care"]);
    const bothId = await addMemo(["care", "hospital"]);
    await addMemo([]);
    await addMemo(["care"], { id: "kuro", householdId: "home" });
    const deletedId = await addMemo(["hospital"]);
    await db
      .update(memoRecords)
      .set({ deletedAt: new Date() })
      .where(eq(memoRecords.id, deletedId));

    const ids = async (labelId?: string) =>
      (await listMemoRecords("tama", { labelId })).map(({ id }) => id).sort();
    expect(await ids("care")).toEqual([careId, bothId].sort());
    expect(await ids("hospital")).toEqual([bothId]);
    expect(await ids()).toHaveLength(3);

    expect((await listMemoLabelsUsedByCat("tama")).map(({ id }) => id)).toEqual(
      ["care", "hospital"],
    );
    expect((await listMemoLabelsUsedByCat("kuro")).map(({ id }) => id)).toEqual(
      ["care"],
    );

    expect(
      (await listMemoLabelsWithCount(["home", "other"])).map(
        ({ id, memoCount }) => ({ id, memoCount }),
      ),
    ).toEqual([
      { id: "care", memoCount: 3 },
      { id: "hospital", memoCount: 1 },
      { id: "other-label", memoCount: 0 },
    ]);
  });
});
