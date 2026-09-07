import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumb } from "./Breadcrumb";

describe("Breadcrumb", () => {
  it("各 item のラベルを表示する", () => {
    render(
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: "ミケ" },
        ]}
      />,
    );

    expect(screen.getByText("トップ")).toBeInTheDocument();
    expect(screen.getByText("猫一覧")).toBeInTheDocument();
    expect(screen.getByText("ミケ")).toBeInTheDocument();
  });

  it("href を持つ item はリンクになる", () => {
    render(
      <Breadcrumb
        items={[{ label: "トップ", href: "/" }, { label: "猫一覧" }]}
      />,
    );

    expect(screen.getByRole("link", { name: "トップ" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("最後の item は href があってもリンクにならず、現在地として示す", () => {
    render(
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "ミケ", href: "/cats/1" },
        ]}
      />,
    );

    expect(
      screen.queryByRole("link", { name: "ミケ" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("ミケ")).toHaveAttribute("aria-current", "page");
  });
});
