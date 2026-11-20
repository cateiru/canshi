import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilterTabs } from "./FilterTabs";

const ITEMS = [
  { key: "all", href: "/expenses?scope=all", label: "すべての支出" },
  { key: "cat", href: "/expenses?scope=cat", label: "たまのみ" },
];

describe("FilterTabs", () => {
  it("項目をリンクで並べ、選択中の項目に aria-current とチェックを付ける", () => {
    render(
      <FilterTabs
        aria-label="支出の絞り込み"
        items={ITEMS}
        selectedKey="cat"
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "支出の絞り込み" }),
    ).toBeInTheDocument();

    const selected = screen.getByRole("link", { name: "たまのみ" });
    expect(selected).toHaveAttribute("href", "/expenses?scope=cat");
    expect(selected).toHaveAttribute("aria-current", "page");
    expect(selected.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    const other = screen.getByRole("link", { name: "すべての支出" });
    expect(other).not.toHaveAttribute("aria-current");
    expect(other.querySelector("svg")).toBeNull();
  });
});
