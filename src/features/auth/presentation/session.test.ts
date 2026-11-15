import { describe, expect, it, vi } from "vitest";

const cats = {
  tama: { id: "tama", memorialDate: null },
  sora: { id: "sora", memorialDate: "2026-07-10" },
} as const;

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("../infrastructure/sessions", () => ({
  getSessionUser: async () => ({ id: "user-1" }),
}));
vi.mock("@/features/households/infrastructure/queries", () => ({
  getCatForUser: async (_userId: string, catId: string) =>
    cats[catId as keyof typeof cats] ?? null,
  getHouseholdForUser: async () => null,
  listCatsForUser: async () => [],
}));

const { getWritableCat, requireCatAccess, requireWritableCatAccess } =
  await import("./session");

describe("requireWritableCatAccess", () => {
  it("メモリーへ移した猫なら、猫のページへ移動する", async () => {
    await expect(requireWritableCatAccess("sora")).rejects.toThrow(
      "REDIRECT:/cats/sora",
    );
    // 参照はこれまでどおりできる
    expect((await requireCatAccess("sora")).cat).toEqual(cats.sora);
  });

  it("メモリーへ移していない猫なら、ユーザーと猫を返す", async () => {
    expect(await requireWritableCatAccess("tama")).toEqual({
      user: { id: "user-1" },
      cat: cats.tama,
    });
  });

  it("参照できない猫は 404 にする", async () => {
    await expect(requireWritableCatAccess("other")).rejects.toThrow(
      "NOT_FOUND",
    );
  });
});

describe("getWritableCat", () => {
  it("メモリーへ移した猫・参照できない猫は null", async () => {
    expect(await getWritableCat("tama")).toEqual(cats.tama);
    expect(await getWritableCat("sora")).toBeNull();
    expect(await getWritableCat("other")).toBeNull();
  });
});
