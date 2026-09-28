import { render, screen } from "@testing-library/react";
import { TbSettings } from "react-icons/tb";
import { describe, expect, it } from "vitest";
import { NavCard } from "./NavCard";

describe("NavCard", () => {
  it("行型はアイコン・タイトル・説明・右矢印を描画し、アイコンは読み上げない", () => {
    render(
      <NavCard
        href="/settings"
        icon={TbSettings}
        title="設定を開く"
        titleAs="h2"
        description="通知やごはんの共通設定"
      />,
    );

    const link = screen.getByRole("link", { name: /設定を開く/ });
    expect(link).toHaveAttribute("href", "/settings");
    expect(
      screen.getByRole("heading", { level: 2, name: "設定を開く" }),
    ).toBeInTheDocument();
    expect(link).toHaveTextContent("通知やごはんの共通設定");

    const icons = link.querySelectorAll("svg");
    expect(icons).toHaveLength(2);
    for (const icon of icons) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("タイル型は右矢印を描画しない", () => {
    render(
      <NavCard href="/weight" layout="tile" icon={TbSettings} title="体重" />,
    );

    const link = screen.getByRole("link", { name: "体重" });
    expect(link.querySelectorAll("svg")).toHaveLength(1);
  });

  it("アイコンの代わりに avatar を先頭に描画できる", () => {
    render(
      <NavCard
        href="/cat"
        avatar={<img src="/cat.png" alt="" />}
        title="たま"
      />,
    );

    const link = screen.getByRole("link", { name: "たま" });
    expect(link.firstElementChild?.tagName).toBe("IMG");
  });
});
