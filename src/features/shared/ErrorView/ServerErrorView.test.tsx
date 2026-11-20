import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServerErrorView } from "./ServerErrorView";

describe("ServerErrorView", () => {
  it("見出しとトップページへのリンクを表示する", () => {
    render(<ServerErrorView error={new Error("boom")} retry={() => {}} />);
    expect(
      screen.getByRole("heading", { name: "エラーが発生しました" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "トップページへ戻る" }),
    ).toHaveAttribute("href", "/");
  });

  it("「もう一度読み込む」で retry を呼ぶ", () => {
    const retry = vi.fn();
    render(<ServerErrorView error={new Error("boom")} retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("サーバーのエラーの digest をエラー ID として表示する", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<ServerErrorView error={error} retry={() => {}} />);
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("digest のないエラーではエラー ID を表示しない", () => {
    render(<ServerErrorView error="boom" retry={() => {}} />);
    expect(screen.queryByText(/エラー ID/)).not.toBeInTheDocument();
  });
});
