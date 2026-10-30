// @vitest-environment node

import { webcrypto } from "node:crypto";
import type { VapidKeys } from "@block65/webcrypto-web-push";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { pushSubscriptions, pushTestRequests, users } from "@/db/schema";

// sql.js は D1 と同じ SQLite 方言のテスト用スタブ（`sendPush.test.ts` と同様）。
// `listPushTestTargets` が内部で呼ぶ `getDb` も、このテスト用の db に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const {
  TEST_PUSH_MESSAGE,
  listPushTestTargets,
  nextScheduledRunAt,
  requestTestPush,
  sendTestPush,
} = await import("./sendTestPush");

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  return Buffer.from(new Uint8Array(bytes)).toString("base64url");
}

/** テスト用の「端末」の ECDH 鍵ペアと auth secret（`pushSubscriptions.p256dh`／`auth`） */
async function createClientKeys() {
  const keyPair = await webcrypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const raw = await webcrypto.subtle.exportKey("raw", keyPair.publicKey);
  const auth = webcrypto.getRandomValues(new Uint8Array(16));
  return { p256dh: toBase64Url(raw), auth: toBase64Url(auth) };
}

/** テスト用の VAPID 鍵ペア */
async function createVapidKeys(): Promise<VapidKeys> {
  const keyPair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const publicRaw = await webcrypto.subtle.exportKey("raw", keyPair.publicKey);
  const jwk = await webcrypto.subtle.exportKey("jwk", keyPair.privateKey);
  return {
    subject: "mailto:test@example.com",
    publicKey: toBase64Url(publicRaw),
    privateKey: jwk.d as string,
  };
}

let vapid: VapidKeys;

beforeAll(async () => {
  const SQL = await initSqlJs();
  const raw = drizzle(new SQL.Database());
  await migrate(raw, { migrationsFolder: "./drizzle" });
  db = raw as unknown as ReturnType<typeof getDb>;
  await db.insert(users).values([
    { id: "user-1", name: "わたし" },
    { id: "user-2", name: "別の人" },
  ]);
  vapid = await createVapidKeys();
});

beforeEach(async () => {
  vi.restoreAllMocks();
  await db.delete(pushTestRequests);
  await db.delete(pushSubscriptions);
});

async function insertSubscription(userId = "user-1", failureCount = 0) {
  const client = await createClientKeys();
  const [row] = await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: `https://push.example.com/${crypto.randomUUID()}`,
      p256dh: client.p256dh,
      auth: client.auth,
      failureCount,
    })
    .returning();
  return row;
}

async function listRequests() {
  return db.select().from(pushTestRequests);
}

describe("nextScheduledRunAt", () => {
  it("次の 15 分区切りの時刻を返す", () => {
    expect(
      nextScheduledRunAt(new Date("2026-10-30T03:07:30Z")).toISOString(),
    ).toBe("2026-10-30T03:15:00.000Z");
  });

  it("区切りちょうどの場合は次の回の時刻を返す", () => {
    expect(
      nextScheduledRunAt(new Date("2026-10-30T03:15:00Z")).toISOString(),
    ).toBe("2026-10-30T03:30:00.000Z");
  });

  it("日付をまたぐ場合も次の区切りを返す", () => {
    expect(
      nextScheduledRunAt(new Date("2026-10-30T23:59:59Z")).toISOString(),
    ).toBe("2026-10-31T00:00:00.000Z");
  });
});

describe("requestTestPush", () => {
  it("自分の購読へのテスト通知を予約する", async () => {
    const subscription = await insertSubscription();

    const result = await requestTestPush(db, "user-1", subscription.endpoint);

    expect(result).toEqual({ outcome: "requested" });
    const requests = await listRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].subscriptionId).toBe(subscription.id);
  });

  it("同じ端末で予約し直しても予約は 1 件のまま", async () => {
    const subscription = await insertSubscription();

    await requestTestPush(db, "user-1", subscription.endpoint);
    await requestTestPush(db, "user-1", subscription.endpoint);

    expect(await listRequests()).toHaveLength(1);
  });

  it("別のユーザーの購読には予約できない", async () => {
    const subscription = await insertSubscription("user-2");

    const result = await requestTestPush(db, "user-1", subscription.endpoint);

    expect(result).toEqual({ outcome: "not-subscribed" });
    expect(await listRequests()).toHaveLength(0);
  });

  it("登録されていない端末には予約できない", async () => {
    const result = await requestTestPush(
      db,
      "user-1",
      "https://push.example.com/unknown",
    );

    expect(result).toEqual({ outcome: "not-subscribed" });
    expect(await listRequests()).toHaveLength(0);
  });
});

describe("sendTestPush", () => {
  async function requestFor(userId = "user-1", failureCount = 0) {
    const subscription = await insertSubscription(userId, failureCount);
    await requestTestPush(db, userId, subscription.endpoint);
    const [target] = await listPushTestTargets();
    return target;
  }

  it("予約と送り先の購読を一覧できる", async () => {
    const subscription = await insertSubscription();
    await requestTestPush(db, "user-1", subscription.endpoint);

    const targets = await listPushTestTargets();

    expect(targets).toHaveLength(1);
    expect(targets[0].subscription.id).toBe(subscription.id);
  });

  it("予約した端末へ送り、送れたら予約を削除して lastUsedAt を更新する", async () => {
    const target = await requestFor("user-1", 2);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTestPush(db, target, vapid);

    expect(result).toEqual({ outcome: "sent" });
    expect(fetchMock).toHaveBeenCalledWith(
      target.subscription.endpoint,
      expect.anything(),
    );
    expect(await listRequests()).toHaveLength(0);
    const [updated] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, target.subscription.id));
    expect(updated.failureCount).toBe(0);
    expect(updated.lastUsedAt).not.toBeNull();
  });

  it("410 を返したら購読と予約を削除する", async () => {
    const target = await requestFor();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 410 })),
    );

    const result = await sendTestPush(db, target, vapid);

    expect(result).toEqual({ outcome: "removed" });
    expect(await listRequests()).toHaveLength(0);
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, target.subscription.id));
    expect(rows).toHaveLength(0);
  });

  it("429／5xx の場合は予約を残し、呼び出し側のリトライに委ねる", async () => {
    const target = await requestFor();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );

    const result = await sendTestPush(db, target, vapid);

    expect(result).toEqual({ outcome: "retriable", status: 503 });
    expect(await listRequests()).toHaveLength(1);
  });

  it("それ以外の失敗では failureCount を加算し、予約を削除する", async () => {
    const target = await requestFor();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 400 })),
    );

    const result = await sendTestPush(db, target, vapid);

    expect(result).toEqual({ outcome: "failed", status: 400 });
    expect(await listRequests()).toHaveLength(0);
    const [updated] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, target.subscription.id));
    expect(updated.failureCount).toBe(1);
  });

  it("fetch が例外を投げた場合は予約を残したまま投げ直す", async () => {
    const target = await requestFor();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    await expect(sendTestPush(db, target, vapid)).rejects.toThrow(
      "network error",
    );
    expect(await listRequests()).toHaveLength(1);
  });

  it("テスト通知の中身は通知設定ページを開くものにする", () => {
    expect(TEST_PUSH_MESSAGE.url).toBe("/settings/notifications");
  });
});
