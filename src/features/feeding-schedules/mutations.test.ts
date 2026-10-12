// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  feedingSchedules,
  householdMembers,
  households,
  users,
} from "@/db/schema";
import {
  createFeedingSchedule,
  deleteFeedingSchedule,
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

  it("家のメンバーは削除できる", async () => {
    expect(
      await deleteFeedingSchedule("home", "member", "home-morning"),
    ).toEqual({ ok: true });
    expect(await listFeedingSchedules("home")).toEqual([]);
  });
});
