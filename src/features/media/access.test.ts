import { describe, expect, it, vi } from "vitest";
import { canAccessMediaAsset, canDeleteMediaAsset } from "./access";

// user-1 の家（household-1）の猫は tama だけで、user-1 と user-3 が同じ家に所属しているとする
vi.mock("@/features/households/queries", () => ({
  getCatForUser: async (userId: string, catId: string) =>
    userId === "user-1" && catId === "tama" ? { id: "tama" } : null,
  getHouseholdForUser: async (userId: string, householdId: string) =>
    ["user-1", "user-3"].includes(userId) && householdId === "household-1"
      ? { id: "household-1" }
      : null,
  sharesHousehold: async (userId: string, otherUserId: string) =>
    userId === otherUserId ||
    [userId, otherUserId].sort().join() === "user-1,user-3",
}));
// 支出 expense-1・商品 food-1 は household-1 のもの、expense-legacy・food-legacy は
// 家に未所属のものとする
vi.mock("./recordOwner", () => ({
  resolveMediaRecordOwner: async (_recordType: string, recordId: string) =>
    ({
      "expense-1": { catId: null, householdId: "household-1" },
      "expense-legacy": { catId: null, householdId: null },
      "food-1": { catId: null, householdId: "household-1" },
      "food-legacy": { catId: null, householdId: null },
    })[recordId] ?? null,
}));

describe("canAccessMediaAsset", () => {
  it("記録に紐付く前の下書きは、アップロードした本人だけが扱える", async () => {
    const draft = {
      catId: null,
      recordType: "pending",
      recordId: "draft",
      uploadedByUserId: "user-1",
    };
    expect(await canAccessMediaAsset("user-1", draft)).toBe(true);
    expect(await canAccessMediaAsset("user-2", draft)).toBe(false);
    // ユーザーの導入前にアップロードされた下書きは誰も扱えない
    expect(
      await canAccessMediaAsset("user-1", { ...draft, uploadedByUserId: null }),
    ).toBe(false);
  });

  it("猫に紐付くメディアは、その猫の家のユーザーだけが扱える", async () => {
    const asset = {
      catId: "tama",
      recordType: "poop_record",
      recordId: "poop",
      uploadedByUserId: "user-1",
    };
    expect(await canAccessMediaAsset("user-1", asset)).toBe(true);
    expect(await canAccessMediaAsset("user-2", asset)).toBe(false);
  });

  it("ごはん商品の画像は、商品の家のユーザーだけが扱える", async () => {
    const asset = {
      catId: null,
      recordType: "food_product",
      recordId: "food-1",
      uploadedByUserId: "user-1",
    };
    expect(await canAccessMediaAsset("user-1", asset)).toBe(true);
    expect(await canAccessMediaAsset("user-3", asset)).toBe(true);
    expect(await canAccessMediaAsset("user-2", asset)).toBe(false);
    // 家に未所属の商品・存在しない商品の画像は誰も扱えない
    expect(
      await canAccessMediaAsset("user-1", {
        ...asset,
        recordId: "food-legacy",
      }),
    ).toBe(false);
    expect(
      await canAccessMediaAsset("user-1", { ...asset, recordId: "missing" }),
    ).toBe(false);
  });

  it("支出の添付は、支出の家のユーザーだけが扱える", async () => {
    const asset = {
      catId: null,
      recordType: "expense",
      recordId: "expense-1",
      uploadedByUserId: "user-1",
    };
    expect(await canAccessMediaAsset("user-1", asset)).toBe(true);
    expect(await canAccessMediaAsset("user-3", asset)).toBe(true);
    expect(await canAccessMediaAsset("user-2", asset)).toBe(false);
    // 家に未所属の支出・存在しない支出の添付は誰も扱えない
    expect(
      await canAccessMediaAsset("user-1", {
        ...asset,
        recordId: "expense-legacy",
      }),
    ).toBe(false);
    expect(
      await canAccessMediaAsset("user-1", { ...asset, recordId: "missing" }),
    ).toBe(false);
  });

  it("ユーザーのアイコン画像は、本人と同じ家のメンバーだけが参照できる", async () => {
    const icon = {
      catId: null,
      recordType: "user_icon",
      recordId: "user-1",
      uploadedByUserId: "user-1",
    };
    expect(await canAccessMediaAsset("user-1", icon)).toBe(true);
    expect(await canAccessMediaAsset("user-3", icon)).toBe(true);
    expect(await canAccessMediaAsset("user-2", icon)).toBe(false);
  });
});

describe("canDeleteMediaAsset", () => {
  it("ユーザーのアイコン画像は、同じ家のメンバーでも本人以外は削除できない", async () => {
    const icon = {
      catId: null,
      recordType: "user_icon",
      recordId: "user-1",
      uploadedByUserId: "user-1",
    };
    expect(await canDeleteMediaAsset("user-1", icon)).toBe(true);
    expect(await canDeleteMediaAsset("user-3", icon)).toBe(false);
    expect(await canDeleteMediaAsset("user-2", icon)).toBe(false);
  });

  it("アイコン以外は、参照できるメディアなら削除できる", async () => {
    const asset = {
      catId: "tama",
      recordType: "poop_record",
      recordId: "poop",
      uploadedByUserId: "user-1",
    };
    expect(await canDeleteMediaAsset("user-1", asset)).toBe(true);
    expect(await canDeleteMediaAsset("user-2", asset)).toBe(false);
  });
});
