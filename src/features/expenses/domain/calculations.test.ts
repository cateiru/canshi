import { describe, expect, it } from "vitest";
import { sumExpenseAmounts, sumExpenseAmountsByCategory } from "./calculations";

describe("sumExpenseAmounts", () => {
  it("支出がなければ 0 を返す", () => {
    expect(sumExpenseAmounts([])).toBe(0);
  });

  it("金額を合計する", () => {
    expect(
      sumExpenseAmounts([
        { amountYen: 1280, category: "food" },
        { amountYen: 550, category: "treat" },
        { amountYen: 5500, category: "hospital" },
      ]),
    ).toBe(7330);
  });
});

describe("sumExpenseAmountsByCategory", () => {
  it("カテゴリごとに合計し、金額の多い順に返す", () => {
    expect(
      sumExpenseAmountsByCategory([
        { amountYen: 1280, category: "food" },
        { amountYen: 550, category: "treat" },
        { amountYen: 720, category: "food" },
        { amountYen: 5500, category: "hospital" },
      ]),
    ).toEqual([
      { category: "hospital", amountYen: 5500 },
      { category: "food", amountYen: 2000 },
      { category: "treat", amountYen: 550 },
    ]);
  });

  it("金額が同じカテゴリはカテゴリの定義順に並ぶ", () => {
    expect(
      sumExpenseAmountsByCategory([
        { amountYen: 500, category: "other" },
        { amountYen: 500, category: "toy" },
        { amountYen: 500, category: "food" },
      ]),
    ).toEqual([
      { category: "food", amountYen: 500 },
      { category: "toy", amountYen: 500 },
      { category: "other", amountYen: 500 },
    ]);
  });

  it("支出がなければ空配列を返す", () => {
    expect(sumExpenseAmountsByCategory([])).toEqual([]);
  });
});
