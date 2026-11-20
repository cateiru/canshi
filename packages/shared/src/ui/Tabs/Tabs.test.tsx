import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs } from "./Tabs";

const ITEMS = [
  { id: "food", label: "ごはん", content: <p>ごはんの記録</p> },
  { id: "weight", label: "体重", content: <p>体重の記録</p> },
];

describe("Tabs", () => {
  it("タブと選択中のパネルを表示する", () => {
    render(<Tabs items={ITEMS} aria-label="記録" />);

    expect(screen.getByRole("tab", { name: "ごはん" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "体重" })).toBeInTheDocument();
    expect(screen.getByText("ごはんの記録")).toBeInTheDocument();
  });
});
