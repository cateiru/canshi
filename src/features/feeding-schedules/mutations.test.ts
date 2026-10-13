// @vitest-environment node

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  feedingSchedules,
  householdMembers,
  households,
  notifications,
  users,
} from "@/db/schema";
import {
  createFeedingSchedule,
  deleteFeedingSchedule,
  dismissFeedingNotificationsOfCatlessHouseholds,
  listFeedingSchedules,
  updateFeedingScheduleNotify,
} from "./mutations";

// `src/features/households/management.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
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
    { id: "member", name: "家族" },
    { id: "outsider", name: "別の家の人" },
  ]);
  await db.insert(households).values([
    { id: "home", name: "わが家" },
    { id: "other", name: "別の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "home", userId: "member" },
    { householdId: "other", userId: "outsider", role: "owner" },
  ]);
});

const enabled = { notifyAtTime: true, remindIfNotRecorded: true };

describe("createFeedingSchedule", () => {
  it("家のメンバーはごはんの時間を追加でき、時刻順に並ぶ", async () => {
    expect(
      await createFeedingSchedule("home", "member", {
        time: "19:00",
        ...enabled,
      }),
    ).toEqual({ ok: true });
    expect(
      await createFeedingSchedule("home", "member", {
        time: "07:00",
        notifyAtTime: false,
        remindIfNotRecorded: true,
      }),
    ).toEqual({ ok: true });

    const schedules = await listFeedingSchedules("home");
    expect(
      schedules.map(({ time, notifyAtTime, remindIfNotRecorded }) => ({
        time,
        notifyAtTime,
        remindIfNotRecorded,
      })),
    ).toEqual([
      { time: "07:00", notifyAtTime: false, remindIfNotRecorded: true },
      { time: "19:00", notifyAtTime: true, remindIfNotRecorded: true },
    ]);
  });

  it("同じ家に同じ時刻は追加できない", async () => {
    await createFeedingSchedule("home", "member", {
      time: "07:00",
      ...enabled,
    });
    expect(
      await createFeedingSchedule("home", "member", {
        time: "07:00",
        ...enabled,
      }),
    ).toEqual({ ok: false, error: "07:00はすでに追加されています" });
    expect(await listFeedingSchedules("home")).toHaveLength(1);
  });

  it("家のメンバーでなければ追加できない", async () => {
    expect(
      await createFeedingSchedule("home", "outsider", {
        time: "07:00",
        ...enabled,
      }),
    ).toEqual({ ok: false, error: "07:00を追加できませんでした" });
    expect(await listFeedingSchedules("home")).toEqual([]);
  });
});

describe("updateFeedingScheduleNotify・deleteFeedingSchedule", () => {
  beforeEach(async () => {
    await db.insert(feedingSchedules).values([
      { id: "home-morning", householdId: "home", time: "07:00" },
      { id: "other-morning", householdId: "other", time: "07:00" },
    ]);
  });

  it("家のメンバーは通知の設定を変えられる", async () => {
    expect(
      await updateFeedingScheduleNotify("home", "member", "home-morning", {
        notifyAtTime: false,
        remindIfNotRecorded: false,
      }),
    ).toEqual({ ok: true });
    const [schedule] = await listFeedingSchedules("home");
    expect(schedule).toMatchObject({
      notifyAtTime: false,
      remindIfNotRecorded: false,
    });
  });

  it("別の家のごはんの時間は、自分の家の ID と組み合わせても変更・削除できない", async () => {
    expect(
      await updateFeedingScheduleNotify("home", "member", "other-morning", {
        notifyAtTime: false,
        remindIfNotRecorded: false,
      }),
    ).toMatchObject({ ok: false });
    expect(
      await deleteFeedingSchedule("home", "member", "other-morning"),
    ).toMatchObject({ ok: false });

    const [schedule] = await listFeedingSchedules("other");
    expect(schedule).toMatchObject({
      id: "other-morning",
      notifyAtTime: true,
      remindIfNotRecorded: true,
    });
  });

  it("家のメンバーでなければ変更・削除できない", async () => {
    expect(
      await deleteFeedingSchedule("home", "outsider", "home-morning"),
    ).toMatchObject({ ok: false });
    expect(await listFeedingSchedules("home")).toHaveLength(1);
  });

  async function addNotification(
    id: string,
    householdId: string,
    referenceId: string,
    status: "pending" | "snoozed" | "done",
    kind: "feeding_time" | "feeding_not_recorded" = "feeding_time",
  ) {
    await db.insert(notifications).values({
      id,
      householdId,
      kind,
      referenceId,
      dedupeKey: id,
      title: "ごはんの時間です",
      body: "本文",
      url: "/cats",
      dueAt: new Date("2026-09-21T07:00:00.000Z"),
      status,
    });
  }

  async function statusOf(id: string) {
    const [row] = await db
      .select({ status: notifications.status })
      .from(notifications)
      .where(eq(notifications.id, id));
    return row.status;
  }

  it("通知をオフにすると、その種類の未対応の通知だけを無視にする", async () => {
    await addNotification("time", "home", "home-morning", "pending");
    await addNotification("time-done", "home", "home-morning", "done");
    await addNotification(
      "reminder",
      "home",
      "home-morning",
      "snoozed",
      "feeding_not_recorded",
    );

    expect(
      await updateFeedingScheduleNotify("home", "member", "home-morning", {
        notifyAtTime: false,
        remindIfNotRecorded: true,
      }),
    ).toEqual({ ok: true });
    expect(await statusOf("time")).toBe("dismissed");
    // 対応済みの通知と、オンのままの種類の通知はそのまま
    expect(await statusOf("time-done")).toBe("done");
    expect(await statusOf("reminder")).toBe("snoozed");

    await updateFeedingScheduleNotify("home", "member", "home-morning", {
      notifyAtTime: false,
      remindIfNotRecorded: false,
    });
    expect(await statusOf("reminder")).toBe("dismissed");
  });

  it("変更できないときは、通知も無視にしない", async () => {
    await addNotification("time", "home", "home-morning", "pending");
    await addNotification("other", "other", "other-morning", "pending");

    // 家のメンバーでない
    expect(
      await updateFeedingScheduleNotify("home", "outsider", "home-morning", {
        notifyAtTime: false,
        remindIfNotRecorded: false,
      }),
    ).toMatchObject({ ok: false });
    // 別の家のごはんの時間を、自分の家の ID と組み合わせる
    expect(
      await updateFeedingScheduleNotify("home", "member", "other-morning", {
        notifyAtTime: false,
        remindIfNotRecorded: false,
      }),
    ).toMatchObject({ ok: false });

    expect(await statusOf("time")).toBe("pending");
    expect(await statusOf("other")).toBe("pending");
  });

  it("家のメンバーは削除でき、その時間の未対応の通知は無視にする", async () => {
    await addNotification("pending", "home", "home-morning", "pending");
    await addNotification("snoozed", "home", "home-morning", "snoozed");
    await addNotification("done", "home", "home-morning", "done");
    await addNotification("other", "other", "other-morning", "pending");

    expect(
      await deleteFeedingSchedule("home", "member", "home-morning"),
    ).toEqual({ ok: true });
    expect(await listFeedingSchedules("home")).toEqual([]);

    expect(await statusOf("pending")).toBe("dismissed");
    expect(await statusOf("snoozed")).toBe("dismissed");
    // 対応済みの通知と、ほかの家の通知はそのまま
    expect(await statusOf("done")).toBe("done");
    expect(await statusOf("other")).toBe("pending");
  });

  it("削除できないときは、通知も無視にしない", async () => {
    await addNotification("pending", "home", "home-morning", "pending");

    expect(
      await deleteFeedingSchedule("home", "outsider", "home-morning"),
    ).toMatchObject({ ok: false });
    expect(await statusOf("pending")).toBe("pending");
  });
});

describe("dismissFeedingNotificationsOfCatlessHouseholds", () => {
  beforeEach(async () => {
    await db.insert(households).values({ id: "second", name: "実家" });
    await db
      .insert(householdMembers)
      .values({ householdId: "second", userId: "member" });
    // 猫がいるのは実家だけ。わが家と別の家には猫がいない
    await db.insert(cats).values({
      id: "tama",
      name: "たま",
      sex: "female",
      householdId: "second",
    });
  });

  async function addNotification(
    id: string,
    householdId: string,
    status: "pending" | "snoozed" | "done",
    kind: "feeding_time" | "feeding_not_recorded" = "feeding_time",
  ) {
    await db.insert(notifications).values({
      id,
      householdId,
      kind,
      referenceId: `${householdId}-morning`,
      dedupeKey: id,
      title: "ごはんの時間です",
      body: "本文",
      url: "/cats",
      dueAt: new Date("2026-09-21T07:00:00.000Z"),
      status,
    });
  }

  async function statusOf(id: string) {
    const [row] = await db
      .select({ status: notifications.status })
      .from(notifications)
      .where(eq(notifications.id, id));
    return row.status;
  }

  it("所属する家のうち猫のいない家の、未対応のごはんの通知を無視にする", async () => {
    await addNotification("home-time", "home", "pending");
    await addNotification(
      "home-reminder",
      "home",
      "snoozed",
      "feeding_not_recorded",
    );
    await addNotification("home-done", "home", "done");
    await addNotification("second-time", "second", "pending");
    await addNotification("other-time", "other", "pending");

    await dismissFeedingNotificationsOfCatlessHouseholds(db, "member");

    expect(await statusOf("home-time")).toBe("dismissed");
    expect(await statusOf("home-reminder")).toBe("dismissed");
    // 対応済みの通知、猫のいる家の通知、所属していない家の通知はそのまま
    expect(await statusOf("home-done")).toBe("done");
    expect(await statusOf("second-time")).toBe("pending");
    expect(await statusOf("other-time")).toBe("pending");
  });
});
