import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RECORD_EXPORT_STALE_AFTER_MS } from "../domain/recordExport";
import type { RecordExportListItem } from "../infrastructure/queries";
import { RecordExportList } from "./RecordExportList";

vi.mock("./actions", () => ({
  deleteRecordExportAction: vi.fn(async () => ({})),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

const now = new Date("2026-11-22T06:00:00Z");

function item(
  id: string,
  values: Partial<RecordExportListItem>,
): RecordExportListItem {
  return {
    id,
    recordTypes: ["memo", "poop"],
    includeMedia: false,
    status: "completed",
    failureReason: null,
    sizeBytes: 2048,
    createdAt: new Date("2026-11-22T05:30:00Z"),
    finishedAt: null,
    requestedByName: "家族",
    ...values,
  };
}

describe("RecordExportList", () => {
  it("完了した出力は、記録の種類・大きさを表示し、ダウンロードと削除ができる", () => {
    render(
      <RecordExportList
        householdId="home"
        recordExports={[item("done", { includeMedia: true })]}
        now={now}
      />,
    );

    const card = screen.getByRole("article", {
      name: "2026/11/22 14:30に依頼した出力",
    });
    expect(card).toHaveTextContent("完了");
    expect(card).toHaveTextContent("うんち記録・メモ");
    expect(card).toHaveTextContent("写真・動画含める");
    expect(card).toHaveTextContent("依頼した人家族");
    expect(card).toHaveTextContent("大きさ2 KB");
    const download = within(card).getByRole("link", { name: "ダウンロード" });
    expect(download).toHaveAttribute(
      "href",
      "/api/households/home/record-exports/done/download",
    );
    expect(download).toHaveAttribute("download");
    expect(
      within(card).getByRole("button", {
        name: "2026/11/22 14:30に依頼した出力を削除する",
      }),
    ).toBeInTheDocument();
  });

  it("処理中の出力は、ダウンロードも削除もできない", () => {
    render(
      <RecordExportList
        householdId="home"
        recordExports={[item("running", { status: "processing" })]}
        now={now}
      />,
    );

    expect(screen.getByRole("article")).toHaveTextContent("処理中");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("失敗した出力・止まった出力は、理由を表示し、削除だけできる", () => {
    render(
      <RecordExportList
        householdId="home"
        recordExports={[
          item("large", { status: "failed", failureReason: "too_large" }),
          item("stale", {
            status: "pending",
            createdAt: new Date(
              now.getTime() - RECORD_EXPORT_STALE_AFTER_MS - 1000,
            ),
          }),
        ]}
        now={now}
      />,
    );

    const [large, stale] = screen.getAllByRole("article");
    expect(large).toHaveTextContent("失敗");
    expect(large).toHaveTextContent("写真・動画を含めずに出力するか");
    expect(stale).toHaveTextContent("失敗");
    expect(stale).toHaveTextContent("時間をおいてもう一度お試しください");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
