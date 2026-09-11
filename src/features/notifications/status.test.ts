import { describe, expect, it } from "vitest";
import { isNotificationPending } from "./status";

describe("isNotificationPending", () => {
  it("pending は未対応として扱う", () => {
    expect(
      isNotificationPending(
        { status: "pending", snoozedUntil: null },
        new Date("2026-09-11T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("done は未対応として扱わない", () => {
    expect(
      isNotificationPending(
        { status: "done", snoozedUntil: null },
        new Date("2026-09-11T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("dismissed は未対応として扱わない", () => {
    expect(
      isNotificationPending(
        { status: "dismissed", snoozedUntil: null },
        new Date("2026-09-11T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("snoozed は snoozedUntil 到来前は未対応として扱わない", () => {
    expect(
      isNotificationPending(
        {
          status: "snoozed",
          snoozedUntil: new Date("2026-09-12T00:00:00.000Z"),
        },
        new Date("2026-09-11T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("snoozed は snoozedUntil 到来後は未対応として扱う", () => {
    expect(
      isNotificationPending(
        {
          status: "snoozed",
          snoozedUntil: new Date("2026-09-10T00:00:00.000Z"),
        },
        new Date("2026-09-11T00:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
