import { render, screen } from "@testing-library/react";
import { TbBellOff } from "react-icons/tb";
import { describe, expect, it } from "vitest";
import { RecordCard, RecordEmptyState } from "./RecordCard";

describe("RecordCard", () => {
  it("既定では article として描画し、属性を渡す", () => {
    render(<RecordCard aria-label="2026年9月28日">内容</RecordCard>);

    const card = screen.getByRole("article", { name: "2026年9月28日" });
    expect(card).toHaveTextContent("内容");
  });

  it("as で描画する要素を変えられる", () => {
    const { container } = render(<RecordCard as="section">内容</RecordCard>);
    expect(container.firstChild?.nodeName).toBe("SECTION");
  });
});

describe("RecordEmptyState", () => {
  it("アイコン・文・ボタンを描画し、アイコンは読み上げない", () => {
    const { container } = render(
      <RecordEmptyState
        icon={TbBellOff}
        actions={<button type="button">記録する</button>}
      >
        まだ記録がありません。
      </RecordEmptyState>,
    );

    expect(screen.getByText("まだ記録がありません。").tagName).toBe("P");
    expect(
      screen.getByRole("button", { name: "記録する" }),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("actions がないときはボタンの枠を描画しない", () => {
    const { container } = render(
      <RecordEmptyState>まだ記録がありません。</RecordEmptyState>,
    );
    expect(container.firstChild?.childNodes).toHaveLength(1);
  });
});
