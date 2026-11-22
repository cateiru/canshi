// @vitest-environment node

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  expenseRecordCats,
  expenseRecords,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  householdMembers,
  households,
  mediaAssets,
  memoRecords,
  poopRecords,
  recordExports,
  users,
} from "@/db/schema";
import { RECORD_EXPORT_STALE_AFTER_MS } from "../domain/recordExport";
import {
  hasRunningRecordExport,
  listRecordExports,
} from "../infrastructure/queries";
import type { RecordExportEnv } from "../infrastructure/storage";
import { csvText, readZip } from "../testing/readZip";
import {
  deleteRecordExport,
  failRecordExport,
  RECORD_EXPORT_RUNNING_ERROR,
  requestRecordExport,
  runRecordExport,
} from "./mutations";

let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

/** R2 の代わり。マルチパートアップロードは、完了したときにパートをつないで置く */
class FakeBucket {
  readonly objects = new Map<string, Uint8Array>();
  readonly partSizes: number[] = [];
  /** キーごとの、読んだ回数 */
  readonly reads = new Map<string, number>();
  aborted = 0;
  /** パートを受け取るたびに呼ぶ（書き出しの途中の出来事を作るため） */
  onUploadPart: (() => Promise<void>) | null = null;

  async get(key: string) {
    this.reads.set(key, (this.reads.get(key) ?? 0) + 1);
    const data = this.objects.get(key);
    if (!data) {
      return null;
    }
    return {
      size: data.byteLength,
      // R2 と同じく、少しずつ流す
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < data.byteLength; i += 64 * 1024) {
            controller.enqueue(data.slice(i, i + 64 * 1024));
          }
          controller.close();
        },
      }),
      arrayBuffer: async () => data.slice().buffer,
    };
  }

  async createMultipartUpload(key: string) {
    const parts = new Map<number, Uint8Array>();
    return {
      uploadPart: async (partNumber: number, data: Uint8Array) => {
        await this.onUploadPart?.();
        parts.set(partNumber, data.slice());
        this.partSizes.push(data.byteLength);
        return { partNumber, etag: `${partNumber}` };
      },
      complete: async (uploaded: { partNumber: number }[]) => {
        const chunks = uploaded.map(({ partNumber }) => {
          const part = parts.get(partNumber);
          if (!part) {
            throw new Error("アップロードしていないパートです");
          }
          return part;
        });
        const bytes = new Uint8Array(
          chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0),
        );
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        this.objects.set(key, bytes);
      },
      abort: async () => {
        this.aborted++;
      },
    };
  }

  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      this.objects.delete(key);
    }
  }
}

let bucket: FakeBucket;
let env: RecordExportEnv;
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env }),
}));

const encoder = new TextEncoder();

beforeEach(async () => {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  db = drizzle(sqlite) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
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
  bucket = new FakeBucket();
  env = {
    DB: {} as D1Database,
    MEDIA_BUCKET: bucket as unknown as R2Bucket,
  };

  await db.insert(users).values([
    { id: "member", name: "家族" },
    { id: "outsider", name: "別の家の人" },
  ]);
  await db.insert(households).values([
    { id: "home", name: "わが家" },
    { id: "other", name: "別の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "home", userId: "member", role: "owner" },
    { householdId: "other", userId: "outsider", role: "owner" },
  ]);
  await db.insert(cats).values([
    { id: "tama", householdId: "home", name: "たま", sex: "female" },
    {
      id: "kuro",
      householdId: "home",
      name: "くろ",
      sex: "male",
      memorialDate: "2026-01-01",
    },
    { id: "other-cat", householdId: "other", name: "よそのねこ", sex: "male" },
  ]);
});

/** 出力の対象になる記録と写真を入れる。削除した記録・別の家の記録も入れ、出力に含めないことを確かめる */
async function seedRecords() {
  await db.insert(poopRecords).values([
    {
      id: "poop-2",
      catId: "kuro",
      occurredAt: new Date("2026-06-02T08:00:00Z"),
      consistency: "normal",
      memo: "=1+1",
    },
    {
      id: "poop-1",
      catId: "tama",
      occurredAt: new Date("2026-06-01T08:00:00Z"),
      consistency: "soft",
      hasBlood: true,
    },
    {
      id: "poop-deleted",
      catId: "tama",
      occurredAt: new Date("2026-06-03T08:00:00Z"),
      consistency: "hard",
      deletedAt: new Date("2026-06-04T00:00:00Z"),
    },
    {
      id: "poop-other",
      catId: "other-cat",
      occurredAt: new Date("2026-06-01T08:00:00Z"),
      consistency: "hard",
    },
  ]);
  await db.insert(foodProducts).values({
    id: "food",
    householdId: "home",
    name: "カリカリ",
    kcalPer100g: 350,
    packageAmountG: 500,
    nutritionType: "complete",
    textureType: "dry",
  });
  await db.insert(feedingRecords).values({
    id: "feeding-1",
    catId: "tama",
    occurredAt: new Date("2026-06-01T07:00:00Z"),
  });
  await db.insert(feedingRecordItems).values([
    {
      feedingRecordId: "feeding-1",
      foodProductId: "food",
      givenAmountG: 30,
      leftoverAmountG: 0,
      estimatedIntakeG: 30,
      estimatedKcal: 105,
      sortOrder: 1,
    },
    {
      feedingRecordId: "feeding-1",
      foodProductId: "food",
      givenAmountG: 10,
      leftoverAmountG: 0,
      estimatedIntakeG: 10,
      estimatedKcal: 35,
      sortOrder: 0,
    },
  ]);
  await db.insert(expenseRecords).values([
    {
      id: "expense-1",
      householdId: "home",
      spentAt: new Date("2026-06-01T00:00:00Z"),
      amountYen: 2000,
      category: "food",
    },
    {
      id: "expense-other",
      householdId: "other",
      spentAt: new Date("2026-06-01T00:00:00Z"),
      amountYen: 9999,
      category: "food",
    },
  ]);
  await db.insert(expenseRecordCats).values([
    { expenseRecordId: "expense-1", catId: "tama" },
    { expenseRecordId: "expense-1", catId: "kuro" },
  ]);
  await db.insert(memoRecords).values([
    {
      id: "memo-dated",
      catId: "tama",
      recordedAt: new Date("2026-06-05T10:00:00Z"),
      content: "日付あり",
    },
    {
      id: "memo-undated",
      catId: "tama",
      recordedAt: null,
      content: "日付なし",
    },
  ]);

  await seedMedia("poop-1-a", "poop_record", "poop-1", 1, encoder.encode("b"));
  await seedMedia("poop-1-b", "poop_record", "poop-1", 0, encoder.encode("a"));
  await seedMedia(
    "poop-deleted-a",
    "poop_record",
    "poop-deleted",
    0,
    encoder.encode("deleted"),
  );
  await seedMedia(
    "poop-other-a",
    "poop_record",
    "poop-other",
    0,
    encoder.encode("other"),
  );
  await seedMedia(
    "expense-1-a",
    "expense",
    "expense-1",
    0,
    encoder.encode("receipt"),
  );
  await seedMedia(
    "expense-other-a",
    "expense",
    "expense-other",
    0,
    encoder.encode("other receipt"),
  );
}

async function seedMedia(
  id: string,
  recordType: string,
  recordId: string,
  sortOrder: number,
  data: Uint8Array,
  mimeType = "image/jpeg",
) {
  const objectKey = `${recordType}/${recordId}/${id}`;
  await db.insert(mediaAssets).values({
    id,
    recordType,
    recordId,
    objectKey,
    mimeType,
    sizeBytes: data.byteLength,
    sortOrder,
  });
  bucket.objects.set(objectKey, data);
}

async function requestExport(
  recordTypes: Parameters<typeof requestRecordExport>[2]["recordTypes"],
  includeMedia = false,
) {
  const result = await requestRecordExport("home", "member", {
    recordTypes,
    includeMedia,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.recordExportId;
}

async function getExport(id: string) {
  const [row] = await db
    .select()
    .from(recordExports)
    .where(eq(recordExports.id, id));
  return row;
}

function zipEntries(id: string) {
  const bytes = bucket.objects.get(`record_exports/${id}.zip`);
  if (!bytes) {
    throw new Error("zip がありません");
  }
  return readZip(bytes);
}

function csvOf(id: string, fileName: string) {
  const entry = zipEntries(id).find(({ name }) => name === fileName);
  if (!entry) {
    throw new Error(`${fileName} がありません`);
  }
  return csvText(entry);
}

describe("requestRecordExport", () => {
  it("家のメンバーは出力を依頼でき、処理中（pending）の出力ができる", async () => {
    const id = await requestExport(["memo", "poop"], true);

    expect(await getExport(id)).toMatchObject({
      householdId: "home",
      requestedByUserId: "member",
      recordTypes: ["memo", "poop"],
      includeMedia: true,
      status: "pending",
    });
    expect(await hasRunningRecordExport("home", new Date())).toBe(true);
  });

  it("処理中の出力があれば、新しく依頼できない", async () => {
    await requestExport(["poop"]);

    expect(
      await requestRecordExport("home", "member", {
        recordTypes: ["memo"],
        includeMedia: false,
      }),
    ).toEqual({ ok: false, error: RECORD_EXPORT_RUNNING_ERROR });
    expect(await db.select().from(recordExports)).toHaveLength(1);
  });

  it("ほかの家に処理中の出力があっても依頼できる", async () => {
    await db.insert(recordExports).values({
      householdId: "other",
      requestedByUserId: "outsider",
      recordTypes: ["poop"],
    });

    expect(
      (
        await requestRecordExport("home", "member", {
          recordTypes: ["poop"],
          includeMedia: false,
        })
      ).ok,
    ).toBe(true);
  });

  it("家のメンバーでなければ依頼できない", async () => {
    expect(
      (
        await requestRecordExport("home", "outsider", {
          recordTypes: ["poop"],
          includeMedia: false,
        })
      ).ok,
    ).toBe(false);
    expect(await db.select().from(recordExports)).toEqual([]);
  });

  it("処理中のまま止まった出力は失敗にして、新しく依頼できる", async () => {
    const now = new Date();
    await db.insert(recordExports).values({
      id: "stale",
      householdId: "home",
      requestedByUserId: "member",
      recordTypes: ["poop"],
      status: "processing",
      createdAt: new Date(now.getTime() - RECORD_EXPORT_STALE_AFTER_MS - 1000),
    });
    expect(await hasRunningRecordExport("home", now)).toBe(false);

    const result = await requestRecordExport(
      "home",
      "member",
      { recordTypes: ["poop"], includeMedia: false },
      now,
    );

    expect(result.ok).toBe(true);
    expect(await getExport("stale")).toMatchObject({
      status: "failed",
      failureReason: "error",
    });
  });
});

describe("runRecordExport", () => {
  beforeEach(seedRecords);

  it("選んだ記録の CSV を zip にまとめて R2 に置き、出力を完了にする", async () => {
    const id = await requestExport(["poop", "feeding", "expense", "memo"]);

    await runRecordExport(id, env);

    const recordExport = await getExport(id);
    const zipBytes = bucket.objects.get(`record_exports/${id}.zip`);
    expect(recordExport).toMatchObject({
      status: "completed",
      objectKey: `record_exports/${id}.zip`,
      sizeBytes: zipBytes?.byteLength,
    });
    expect(recordExport.finishedAt).not.toBeNull();
    // 記録の種類は RECORD_EXPORT_TYPES の順。写真・動画は含めない
    expect(zipEntries(id).map(({ name }) => name)).toEqual([
      "feeding_records.csv",
      "poop_records.csv",
      "expenses.csv",
      "memo_records.csv",
    ]);
  });

  it("家のすべてのねこ（メモリーへ移したねこも）の、削除していない記録を古い順に書く", async () => {
    const id = await requestExport(["poop"]);
    await runRecordExport(id, env);

    expect(csvOf(id, "poop_records.csv")).toBe(
      [
        "ID,ねこ,日時,状態,量,色,血液が混じっていた,異物が混じっていた,食欲メモ,元気メモ,備考",
        "poop-1,たま,2026-06-01 08:00,柔らかい,,,はい,いいえ,,,",
        // 数式として解釈される文字で始まる備考には ' を付ける
        "poop-2,くろ,2026-06-02 08:00,ふつう,,,いいえ,いいえ,,,'=1+1",
        "",
      ].join("\r\n"),
    );
  });

  it("ごはんの明細は表示順に並べ、家の支出は関連するねこの名前を添える。日付のないメモは最後に並べる", async () => {
    const id = await requestExport(["feeding", "expense", "memo"]);
    await runRecordExport(id, env);

    const feedingLines = csvOf(id, "feeding_records.csv").split("\r\n");
    expect(feedingLines.slice(1, 3)).toEqual([
      "feeding-1,たま,2026-06-01 07:00,厳格モード,カリカリ,10,0,10,35,,,",
      "feeding-1,たま,2026-06-01 07:00,厳格モード,カリカリ,30,0,30,105,,,",
    ]);
    expect(csvOf(id, "expenses.csv").split("\r\n").slice(1, -1)).toEqual([
      "expense-1,2026-06-01,ご飯,2000,たま、くろ,,",
    ]);
    expect(csvOf(id, "memo_records.csv").split("\r\n").slice(1, -1)).toEqual([
      "memo-dated,たま,2026-06-05 10:00,日付あり",
      "memo-undated,たま,,日付なし",
    ]);
  });

  it("写真・動画を含めるときは、削除していない家の記録の写真を photos に入れ、CSV からたどれるようにする", async () => {
    const id = await requestExport(["poop", "expense"], true);
    await runRecordExport(id, env);

    const entries = zipEntries(id);
    expect(entries.map(({ name }) => name)).toEqual([
      "poop_records.csv",
      "expenses.csv",
      "photos/poop_records/poop-1-1.jpg",
      "photos/poop_records/poop-1-2.jpg",
      "photos/expenses/expense-1-1.jpg",
    ]);
    // 記録の中の表示順に番号を振る
    expect(
      new TextDecoder().decode(
        entries.find(({ name }) => name.endsWith("poop-1-1.jpg"))?.bytes,
      ),
    ).toBe("a");
    expect(csvOf(id, "poop_records.csv")).toContain(
      '"photos/poop_records/poop-1-1.jpg\nphotos/poop_records/poop-1-2.jpg"',
    );
  });

  it("大きな動画も 1 回だけ読んで流し込み、zip を同じ大きさのパートに分けてアップロードする", async () => {
    const video = new Uint8Array(17 * 1024 * 1024).map((_, i) => i % 253);
    await seedMedia(
      "poop-2-video",
      "poop_record",
      "poop-2",
      0,
      video,
      "video/mp4",
    );
    const id = await requestExport(["poop"], true);

    await runRecordExport(id, env);

    expect(bucket.partSizes.slice(0, -1)).toEqual([
      8 * 1024 * 1024,
      8 * 1024 * 1024,
    ]);
    expect(bucket.partSizes.at(-1)).toBeLessThan(8 * 1024 * 1024);
    const entry = zipEntries(id).find(
      ({ name }) => name === "photos/poop_records/poop-2-1.mp4",
    );
    expect(entry?.bytes).toEqual(video);
    expect(bucket.reads.get("poop_record/poop-2/poop-2-video")).toBe(1);
  });

  it("zip が R2 に置ける大きさを超えるときは、写真・動画を読まずに失敗（too_large）にする", async () => {
    // 大きさは media_assets.size_bytes から求めるため、R2 には小さなデータを置いて行の大きさだけを大きくする
    await seedMedia(
      "poop-2-huge",
      "poop_record",
      "poop-2",
      0,
      encoder.encode("huge"),
      "video/mp4",
    );
    await db
      .update(mediaAssets)
      .set({ sizeBytes: 80 * 1024 * 1024 * 1024 })
      .where(eq(mediaAssets.id, "poop-2-huge"));
    const id = await requestExport(["poop"], true);

    await runRecordExport(id, env);

    expect(await getExport(id)).toMatchObject({
      status: "failed",
      failureReason: "too_large",
      objectKey: null,
    });
    expect(bucket.partSizes).toEqual([]);
    expect(bucket.reads.size).toBe(0);
  });

  it("4 GiB を超えても R2 に置ける大きさなら、作り始める（ZIP64 にする）", async () => {
    await seedMedia(
      "poop-2-large",
      "poop_record",
      "poop-2",
      0,
      encoder.encode("large"),
    );
    await db
      .update(mediaAssets)
      .set({ sizeBytes: 5 * 1024 * 1024 * 1024 })
      .where(eq(mediaAssets.id, "poop-2-large"));
    const id = await requestExport(["poop"], true);

    await runRecordExport(id, env);

    expect((await getExport(id)).status).toBe("completed");
  });

  it("完了した出力は、もう一度呼ばれても作り直さない", async () => {
    const id = await requestExport(["poop"]);
    await runRecordExport(id, env);
    const parts = bucket.partSizes.length;

    await runRecordExport(id, env);

    expect(bucket.partSizes).toHaveLength(parts);
    expect((await getExport(id)).status).toBe("completed");
  });

  it("書き出している間に出力が削除されたら、置いた zip を片付ける", async () => {
    const id = await requestExport(["poop"]);
    bucket.onUploadPart = async () => {
      await db.delete(recordExports).where(eq(recordExports.id, id));
    };

    await runRecordExport(id, env);

    expect(bucket.objects.has(`record_exports/${id}.zip`)).toBe(false);
  });

  it("R2 への書き出しに失敗したらアップロードを取り消して例外にし、失敗にできる", async () => {
    const id = await requestExport(["poop"]);
    bucket.onUploadPart = async () => {
      throw new Error("R2 failed");
    };

    await expect(runRecordExport(id, env)).rejects.toThrow("R2 failed");
    expect(bucket.aborted).toBe(1);
    expect((await getExport(id)).status).toBe("processing");

    await failRecordExport(id, env);
    expect(await getExport(id)).toMatchObject({
      status: "failed",
      failureReason: "error",
    });
  });
});

describe("deleteRecordExport", () => {
  async function seedExport(
    id: string,
    values: Partial<typeof recordExports.$inferInsert>,
  ) {
    await db.insert(recordExports).values({
      id,
      householdId: "home",
      requestedByUserId: "member",
      recordTypes: ["poop"],
      ...values,
    });
  }

  it("家のメンバーは、完了した出力を zip ごと削除できる", async () => {
    await seedExport("done", {
      status: "completed",
      objectKey: "record_exports/done.zip",
      sizeBytes: 10,
    });
    bucket.objects.set("record_exports/done.zip", new Uint8Array(10));

    expect(await deleteRecordExport("home", "member", "done")).toEqual({
      ok: true,
    });
    expect(await getExport("done")).toBeUndefined();
    expect(bucket.objects.has("record_exports/done.zip")).toBe(false);
  });

  it("処理中の出力は削除できないが、処理中のまま止まった出力は削除できる", async () => {
    const now = new Date();
    await seedExport("running", { status: "processing", createdAt: now });

    expect(
      (await deleteRecordExport("home", "member", "running", now)).ok,
    ).toBe(false);
    expect(await getExport("running")).toBeDefined();

    const later = new Date(now.getTime() + RECORD_EXPORT_STALE_AFTER_MS + 1000);
    expect(
      (await deleteRecordExport("home", "member", "running", later)).ok,
    ).toBe(true);
    expect(await getExport("running")).toBeUndefined();
  });

  it("家のメンバーでなければ削除できない", async () => {
    await seedExport("failed", { status: "failed" });

    expect((await deleteRecordExport("home", "outsider", "failed")).ok).toBe(
      false,
    );
    expect((await deleteRecordExport("other", "outsider", "failed")).ok).toBe(
      false,
    );
    expect(await getExport("failed")).toBeDefined();
  });
});

describe("listRecordExports", () => {
  it("家の出力を、依頼したユーザーの名前を添えて新しい順に返す", async () => {
    await db.insert(recordExports).values([
      {
        id: "old",
        householdId: "home",
        requestedByUserId: "member",
        recordTypes: ["poop"],
        status: "completed",
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
      {
        id: "new",
        householdId: "home",
        requestedByUserId: "member",
        recordTypes: ["memo"],
        status: "failed",
        createdAt: new Date("2026-06-02T00:00:00Z"),
      },
      {
        id: "other",
        householdId: "other",
        requestedByUserId: "outsider",
        recordTypes: ["memo"],
      },
    ]);

    const rows = await listRecordExports("home");

    expect(
      rows.map(({ id, requestedByName }) => [id, requestedByName]),
    ).toEqual([
      ["new", "家族"],
      ["old", "家族"],
    ]);
  });
});
