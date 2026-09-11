import { describe, expect, it, vi } from "vitest";
import type { Cat } from "@/db/schema/cats";
import { listCats } from "@/features/cats/queries";
import RootPage from "./page";

vi.mock("@/features/cats/queries", () => ({
  listCats: vi.fn(),
}));

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

function buildCat(id: string): Cat {
  return {
    id,
    name: "たま",
    sex: "male",
    birthDate: null,
    breed: null,
    adoptedAt: null,
    profileMediaAssetId: null,
    isProfilePinned: false,
    profileCropX: null,
    profileCropY: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("RootPage", () => {
  it("猫が登録されていない場合は /home にリダイレクトする", async () => {
    vi.mocked(listCats).mockResolvedValue([]);

    await expect(RootPage()).rejects.toThrow("REDIRECT:/home");
  });

  it("猫が1匹だけ登録されている場合はその猫の詳細ページにリダイレクトする", async () => {
    vi.mocked(listCats).mockResolvedValue([buildCat("cat-1")]);

    await expect(RootPage()).rejects.toThrow("REDIRECT:/cats/cat-1");
  });

  it("猫が2匹以上登録されている場合は猫一覧にリダイレクトする", async () => {
    vi.mocked(listCats).mockResolvedValue([
      buildCat("cat-1"),
      buildCat("cat-2"),
    ]);

    await expect(RootPage()).rejects.toThrow("REDIRECT:/cats");
  });
});
