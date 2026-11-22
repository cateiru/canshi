import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissNotificationAction,
  markNotificationDoneAction,
  snoozeNotificationAction,
} from "./actions";
import { NotificationActions } from "./NotificationActions";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("./actions", () => ({
  dismissNotificationAction: vi.fn(),
  markCleaningNotificationDoneAction: vi.fn(),
  markNotificationDoneAction: vi.fn(),
  resolveSymptomNotificationAction: vi.fn(),
  snoozeNotificationAction: vi.fn(),
}));

describe("NotificationActions", () => {
  beforeEach(() => {
    vi.mocked(markNotificationDoneAction).mockReset();
    vi.mocked(dismissNotificationAction).mockReset();
    vi.mocked(snoozeNotificationAction).mockReset();
    refresh.mockReset();
  });

  it.each(["birthday_yearly", "birthday_half_year", "days_milestone"] as const)(
    "お祝いの通知（%s）は延期・無視を出さず「おめでとう」だけを表示する",
    (kind) => {
      render(<NotificationActions notificationId="n1" kind={kind} />);

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "おめでとう" })).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "完了にする" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /延期/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "無視する" }),
      ).not.toBeInTheDocument();
    },
  );

  it("「おめでとう」を押すと通知を完了にし、表示を更新する", async () => {
    vi.mocked(markNotificationDoneAction).mockResolvedValue({});
    render(<NotificationActions notificationId="n1" kind="days_milestone" />);

    fireEvent.click(screen.getByRole("button", { name: "おめでとう" }));

    await waitFor(() => {
      expect(markNotificationDoneAction).toHaveBeenCalledWith("n1");
    });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("お祝い以外の通知は、完了・延期・無視を表示する", () => {
    render(<NotificationActions notificationId="n1" kind="shampoo_elapsed" />);

    expect(screen.getByRole("button", { name: "完了にする" })).toBeVisible();
    expect(screen.getByRole("button", { name: "1日延期" })).toBeVisible();
    expect(screen.getByRole("button", { name: "3日延期" })).toBeVisible();
    expect(screen.getByRole("button", { name: "1週間延期" })).toBeVisible();
    expect(screen.getByRole("button", { name: "無視する" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "おめでとう" }),
    ).not.toBeInTheDocument();
  });
});
