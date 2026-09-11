// @vitest-environment node

import { webcrypto } from "node:crypto";
import type { VapidKeys } from "@block65/webcrypto-web-push";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, notifications, pushSubscriptions } from "@/db/schema";
import { MAX_PUSH_FAILURE_COUNT } from "./defaults";
import { sendPushToSubscription } from "./sendPush";

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

describe("sendPushToSubscription", () => {
  // sql.js は D1 と同じ SQLite 方言のテスト用スタブ（他のスキーマテストと同様）。
  // `sendPushToSubscription` が要求する D1 専用の型（`ReturnType<typeof getDb>`）とは
  // 構造的に異なる（`resultKind` が sync/async で違う）ため、ここだけ型を合わせる
  let db: ReturnType<typeof getDb>;
  let vapid: VapidKeys;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
    await migrate(db as unknown as ReturnType<typeof drizzle>, {
      migrationsFolder: "./drizzle",
    });
    vapid = await createVapidKeys();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  async function insertSubscription(failureCount = 0) {
    const client = await createClientKeys();
    const [row] = await db
      .insert(pushSubscriptions)
      .values({
        endpoint: `https://push.example.com/${crypto.randomUUID()}`,
        p256dh: client.p256dh,
        auth: client.auth,
        failureCount,
      })
      .returning();
    return row;
  }

  async function insertNotification() {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();
    const [notification] = await db
      .insert(notifications)
      .values({
        catId: cat.id,
        kind: "birthday_yearly",
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "たまのお誕生日",
        body: "今日は1歳の誕生日です",
        url: `/cats/${cat.id}`,
        dueAt: new Date(),
      })
      .returning();
    return notification;
  }

  it("2xx を返したら lastUsedAt を更新し failureCount を 0 にリセットする", async () => {
    const subscription = await insertSubscription(2);
    const notification = await insertNotification();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 201 })),
    );

    await sendPushToSubscription(db, subscription, notification, vapid);

    const [updated] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));
    expect(updated.failureCount).toBe(0);
    expect(updated.lastUsedAt).not.toBeNull();
  });

  it("410 を返したら購読を削除する", async () => {
    const subscription = await insertSubscription();
    const notification = await insertNotification();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 410 })),
    );

    await sendPushToSubscription(db, subscription, notification, vapid);

    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));
    expect(rows).toHaveLength(0);
  });

  it("404 を返しても購読を削除する", async () => {
    const subscription = await insertSubscription();
    const notification = await insertNotification();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );

    await sendPushToSubscription(db, subscription, notification, vapid);

    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));
    expect(rows).toHaveLength(0);
  });

  it("上限未満の失敗では failureCount を加算するだけで削除しない", async () => {
    const subscription = await insertSubscription(1);
    const notification = await insertNotification();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await sendPushToSubscription(db, subscription, notification, vapid);

    const [updated] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));
    expect(updated.failureCount).toBe(2);
  });

  it("上限に達したら購読を削除する", async () => {
    const subscription = await insertSubscription(MAX_PUSH_FAILURE_COUNT - 1);
    const notification = await insertNotification();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await sendPushToSubscription(db, subscription, notification, vapid);

    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));
    expect(rows).toHaveLength(0);
  });

  it("fetch が例外を投げた場合は呼び出し側のリトライに委ねるため、そのまま投げ直す", async () => {
    const subscription = await insertSubscription();
    const notification = await insertNotification();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    await expect(
      sendPushToSubscription(db, subscription, notification, vapid),
    ).rejects.toThrow("network error");

    const [unchanged] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));
    expect(unchanged.failureCount).toBe(0);
  });
});
