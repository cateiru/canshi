import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("サービス名を表示する", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "CANSHI" })).toBeInTheDocument();
  });
});
