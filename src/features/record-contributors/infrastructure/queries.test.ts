// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  householdMembers,
  households,
  type NewRecordChangeLog,
  recordChangeLogs,
  users,
} from "@/db/schema";
import { D1KvStore } from "@/features/mcp/infrastructure/d1KvStore";
import { listRecordContributors, recordContributorKey } from "./queries";

let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const d1 = {} as D1Database;

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  // アイコン画像の列は media_assets への外部キーだが、sql.js では制約を有効にしていないため
  // 画像の行は作らない
  await db.insert(users).values([
    { id: "viewer", name: "見る人", iconMediaAssetId: "icon-asset" },
    { id: "member", name: "家族", iconMediaAssetId: "icon-asset" },
    { id: "former", name: "元の家族", iconMediaAssetId: "icon-asset" },
  ]);
  await db.insert(households).values([
    { id: "household-1", name: "家" },
    { id: "household-2", name: "別の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "household-1", userId: "viewer", role: "owner" },
    { householdId: "household-1", userId: "member", role: "member" },
    { householdId: "household-2", userId: "former", role: "owner" },
  ]);
});

async function insertLogs(
  logs: Omit<NewRecordChangeLog, "recordType">[],
  recordType: NewRecordChangeLog["recordType"] = "poop_record",
) {
  await db
    .insert(recordChangeLogs)
    .values(logs.map((log) => ({ recordType, ...log })));
}

describe("listRecordContributors", () => {
  it("作成・編集した人を最初に操作した順に、人ごとに 1 件にまとめて返す", async () => {
    await insertLogs([
      {
        recordId: "record-1",
        action: "create",
        userId: "member",
        createdAt: new Date("2026-07-01T00:00:00Z"),
      },
      {
        recordId: "record-1",
        action: "update",
        userId: "viewer",
        createdAt: new Date("2026-07-02T00:00:00Z"),
      },
      {
        recordId: "record-1",
        action: "update",
        userId: "member",
        createdAt: new Date("2026-07-03T00:00:00Z"),
      },
    ]);

    const result = await listRecordContributors(
      [
        { recordType: "poop_record", recordId: "record-1" },
        { recordType: "poop_record", recordId: "record-without-logs" },
      ],
      "viewer",
      d1,
    );

    expect(result).toEqual(
      new Map([
        [
          recordContributorKey("poop_record", "record-1"),
          [
            { kind: "user", userName: "家族", iconMediaAssetId: "icon-asset" },
            {
              kind: "user",
              userName: "見る人",
              iconMediaAssetId: "icon-asset",
            },
          ],
        ],
      ]),
    );
  });

  it("同じ秒の操作は追加した順にする", async () => {
    const at = new Date("2026-07-01T00:00:00Z");
    await insertLogs([
      {
        recordId: "record-1",
        action: "create",
        userId: "viewer",
        createdAt: at,
      },
      {
        recordId: "record-1",
        action: "update",
        userId: "member",
        createdAt: at,
      },
    ]);

    const result = await listRecordContributors(
      [{ recordType: "poop_record", recordId: "record-1" }],
      "viewer",
      d1,
    );

    expect(
      result
        .get(recordContributorKey("poop_record", "record-1"))
        ?.map((contributor) => contributor.userName),
    ).toEqual(["見る人", "家族"]);
  });

  it("記録の種類が違う同じ ID の履歴・削除の履歴は含めない", async () => {
    await insertLogs([
      { recordId: "record-1", action: "create", userId: "viewer" },
      { recordId: "record-1", action: "delete", userId: "member" },
    ]);
    await insertLogs(
      [{ recordId: "record-1", action: "create", userId: "member" }],
      "vomit_record",
    );

    const result = await listRecordContributors(
      [{ recordType: "poop_record", recordId: "record-1" }],
      "viewer",
      d1,
    );

    expect(result.get(recordContributorKey("poop_record", "record-1"))).toEqual(
      [{ kind: "user", userName: "見る人", iconMediaAssetId: "icon-asset" }],
    );
  });

  it("同じ家にいないユーザーのアイコン画像は返さない", async () => {
    await insertLogs([
      { recordId: "record-1", action: "create", userId: "former" },
    ]);

    const result = await listRecordContributors(
      [{ recordType: "poop_record", recordId: "record-1" }],
      "viewer",
      d1,
    );

    expect(result.get(recordContributorKey("poop_record", "record-1"))).toEqual(
      [{ kind: "user", userName: "元の家族", iconMediaAssetId: null }],
    );
  });

  it("AI との接続からの操作は、接続ごとにアプリとして返し、画面からの操作とは分ける", async () => {
    const store = new D1KvStore(d1);
    await store.put(
      "client:client-chatgpt",
      JSON.stringify({
        clientId: "client-chatgpt",
        clientName: "ChatGPT",
        redirectUris: ["https://chatgpt.com/connector/oauth/callback"],
      }),
    );
    await insertLogs([
      { recordId: "record-1", action: "create", userId: "member" },
      {
        recordId: "record-1",
        action: "update",
        userId: "member",
        mcpClientId: "client-chatgpt",
      },
      {
        recordId: "record-1",
        action: "update",
        userId: "member",
        mcpClientId: "client-unknown",
      },
    ]);

    const result = await listRecordContributors(
      [{ recordType: "poop_record", recordId: "record-1" }],
      "viewer",
      d1,
    );

    expect(result.get(recordContributorKey("poop_record", "record-1"))).toEqual(
      [
        { kind: "user", userName: "家族", iconMediaAssetId: "icon-asset" },
        {
          kind: "ai",
          userName: "家族",
          clientName: "ChatGPT",
          app: "openai",
        },
        { kind: "ai", userName: "家族", clientName: null, app: null },
      ],
    );
  });

  it("記録を指定しなければ問い合わせずに空を返す", async () => {
    expect(await listRecordContributors([], "viewer", d1)).toEqual(new Map());
  });
});
