import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatEarFrame } from "./CatEarFrame";

describe("CatEarFrame", () => {
  it("children を表示する", () => {
    render(<CatEarFrame>猫耳フレーム</CatEarFrame>);
    expect(screen.getByText("猫耳フレーム")).toBeInTheDocument();
  });

  it("渡した className もあわせて反映される", () => {
    render(<CatEarFrame className="extra">内容</CatEarFrame>);
    expect(screen.getByText("内容").className).toMatch(/extra/);
  });
});
