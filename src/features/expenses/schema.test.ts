import { describe, expect, it } from "vitest";
import { hospitalVisitFormSchema } from "@/features/hospital-visits/schema";
import { amountYenSchema, expenseFormSchema, MAX_AMOUNT_YEN } from "./schema";

const expense = {
  spentDate: "2026-09-15",
  amountYen: "1280",
  category: "food",
};
const visit = {
  visitedDate: "2026-09-15",
  visitedTime: "10:00",
  reason: "健診",
};

describe("支出の入力検証", () => {
  it.each([
    "",
    "   ",
    null,
    undefined,
    true,
    [],
    "abc",
    "1.5",
    "-1",
    Infinity,
    MAX_AMOUNT_YEN + 1,
  ])("不正な金額 %j を拒否する", (amountYen) => {
    expect(amountYenSchema.safeParse(amountYen).success).toBe(false);
  });

  it.each([0, "0", " 1280 ", MAX_AMOUNT_YEN])(
    "0円を含む整数 %j を受け付ける",
    (value) => {
      expect(amountYenSchema.parse(value)).toBe(Number(value));
    },
  );

  it("猫の選択は任意で、重複を除去する", () => {
    expect(expenseFormSchema.parse(expense).catIds).toEqual([]);
    expect(
      expenseFormSchema.parse({ ...expense, catIds: ["a", "b", "a"] }).catIds,
    ).toEqual(["a", "b"]);
  });

  it.each([
    { spentDate: "2026-02-30" },
    { category: "unknown" },
    { catIds: [""] },
    { catIds: [42] },
    { memo: "あ".repeat(501) },
  ])("不正な入力 %j を拒否する", (values) => {
    expect(expenseFormSchema.safeParse({ ...expense, ...values }).success).toBe(
      false,
    );
  });

  it("通院費では未入力と0円を区別する", () => {
    for (const value of ["", null, undefined]) {
      expect(
        hospitalVisitFormSchema.parse({ ...visit, expenseAmountYen: value })
          .expenseAmountYen,
      ).toBeUndefined();
    }
    expect(
      hospitalVisitFormSchema.parse({ ...visit, expenseAmountYen: "0" })
        .expenseAmountYen,
    ).toBe(0);
  });
});
