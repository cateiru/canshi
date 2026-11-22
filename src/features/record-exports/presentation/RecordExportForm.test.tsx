import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RECORD_EXPORT_TYPES } from "../domain/recordExport";
import { RecordExportForm } from "./RecordExportForm";

function recordTypeCheckboxes() {
  return screen
    .getAllByRole("checkbox")
    .filter((checkbox) => checkbox.getAttribute("name") === "recordTypes");
}

describe("RecordExportForm", () => {
  it("はじめはすべての記録を選び、写真・動画は含めない", () => {
    render(<RecordExportForm action={vi.fn()} isRunning={false} />);

    expect(recordTypeCheckboxes()).toHaveLength(RECORD_EXPORT_TYPES.length);
    for (const checkbox of recordTypeCheckboxes()) {
      expect(checkbox).toBeChecked();
    }
    expect(
      screen.getByRole("checkbox", { name: "写真・動画を含める" }),
    ).not.toBeChecked();
    expect(screen.getByRole("button", { name: "出力する" })).toBeEnabled();
  });

  it("すべて外すと出力できず、すべて選ぶで戻せる", () => {
    render(<RecordExportForm action={vi.fn()} isRunning={false} />);

    fireEvent.click(screen.getByRole("button", { name: "すべて外す" }));
    for (const checkbox of recordTypeCheckboxes()) {
      expect(checkbox).not.toBeChecked();
    }
    expect(screen.getByRole("button", { name: "出力する" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "すべて選ぶ" }));
    for (const checkbox of recordTypeCheckboxes()) {
      expect(checkbox).toBeChecked();
    }
  });

  it("処理中の出力があるときは、新しく出力できない", () => {
    render(<RecordExportForm action={vi.fn()} isRunning />);

    expect(screen.getByRole("button", { name: "出力中..." })).toBeDisabled();
  });
});
