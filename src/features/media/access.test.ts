import { describe, expect, it, vi } from "vitest";
import { canAccessMediaAsset } from "./access";

// user-1 の家の猫は tama だけとする
vi.mock("@/features/households/queries", () => ({
  getCatForUser: async (userId: string, catId: string) =>
    userId === "user-1" && catId === "tama" ? { id: "tama" } : null,
}));

describe("canAccessMediaAsset", () => {
  it("記録に紐付く前の下書きは、アップロードした本人だけが扱える", async () => {
    const draft = {
      catId: null,
      recordType: "pending",
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
      uploadedByUserId: "user-1",
    };
    expect(await canAccessMediaAsset("user-1", asset)).toBe(true);
    expect(await canAccessMediaAsset("user-2", asset)).toBe(false);
  });

  it("猫に紐付かない共通のメディア（ごはん商品の画像など）は、ログイン中のユーザーなら扱える", async () => {
    const asset = {
      catId: null,
      recordType: "food_product",
      uploadedByUserId: "user-1",
    };
    expect(await canAccessMediaAsset("user-2", asset)).toBe(true);
  });
});
