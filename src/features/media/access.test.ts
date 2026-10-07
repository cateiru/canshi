import { describe, expect, it, vi } from "vitest";
import { canAccessMediaAsset, canDeleteMediaAsset } from "./access";

// user-1 の家の猫は tama だけで、user-1 と user-3 が同じ家に所属しているとする
vi.mock("@/features/households/queries", () => ({
  getCatForUser: async (userId: string, catId: string) =>
    userId === "user-1" && catId === "tama" ? { id: "tama" } : null,
  sharesHousehold: async (userId: string, otherUserId: string) =>
    userId === otherUserId ||
    [userId, otherUserId].sort().join() === "user-1,user-3",
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

  it("猫に紐付かない共通のメディア（ごはん商品の画像など）は、ログイン中のユーザーなら扱える", async () => {
    const asset = {
      catId: null,
      recordType: "food_product",
      recordId: "food",
      uploadedByUserId: "user-1",
    };
    expect(await canAccessMediaAsset("user-2", asset)).toBe(true);
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
