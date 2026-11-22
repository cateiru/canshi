import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECORD_EXPORT_POLLING_INTERVAL_MS,
  RecordExportPolling,
} from "./RecordExportPolling";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  router.refresh.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function respond(running: boolean) {
  return Promise.resolve(Response.json({ running }));
}

describe("RecordExportPolling", () => {
  it("1 秒ごとに状態を確かめ、処理中の出力がなくなったらページを取り直して止まる", async () => {
    fetchMock
      .mockImplementationOnce(() => respond(true))
      .mockImplementationOnce(() => respond(false));
    render(<RecordExportPolling householdId="home" />);

    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(RECORD_EXPORT_POLLING_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/households/home/record-exports/status",
      { cache: "no-store" },
    );
    expect(router.refresh).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(RECORD_EXPORT_POLLING_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(router.refresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(RECORD_EXPORT_POLLING_INTERVAL_MS * 3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("通信に失敗しても、次の確認でやり直す", async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.reject(new Error("offline")))
      .mockImplementationOnce(() => respond(false));
    render(<RecordExportPolling householdId="home" />);

    await vi.advanceTimersByTimeAsync(RECORD_EXPORT_POLLING_INTERVAL_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("ログインが切れた・家から外れたときは、確認をやめてページを取り直す", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(Response.json({ error: "Not Found" }, { status: 404 })),
    );
    render(<RecordExportPolling householdId="home" />);

    await vi.advanceTimersByTimeAsync(RECORD_EXPORT_POLLING_INTERVAL_MS * 3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("ページを離れたら確認をやめる", async () => {
    fetchMock.mockImplementation(() => respond(true));
    const { unmount } = render(<RecordExportPolling householdId="home" />);

    await vi.advanceTimersByTimeAsync(RECORD_EXPORT_POLLING_INTERVAL_MS);
    unmount();
    await vi.advanceTimersByTimeAsync(RECORD_EXPORT_POLLING_INTERVAL_MS * 3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
