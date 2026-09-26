import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BirthdayCelebration } from "./BirthdayCelebration";
import type { BirthdayCelebrationCat } from "./birthday";

function buildCat(
  overrides: Partial<BirthdayCelebrationCat> = {},
): BirthdayCelebrationCat {
  return {
    id: "cat-1",
    name: "たま",
    birthDate: "2023-09-26",
    profileMediaAssetId: null,
    profileCropX: null,
    profileCropY: null,
    profileCropZoom: null,
    profileCropRotation: null,
    ...overrides,
  };
}

describe("BirthdayCelebration", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("誕生日にはお祝いのモーダルを表示し、端末にお祝い済みを記録する", async () => {
    render(<BirthdayCelebration cats={[buildCat()]} />);

    expect(
      await screen.findByRole("dialog", { name: "お誕生日おめでとう！" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("今日はたまの3歳の誕生日です。"),
    ).toBeInTheDocument();
    expect(screen.getByText("約28歳")).toBeInTheDocument();
    expect(
      window.localStorage.getItem("canshi:birthday-celebrated:cat-1:3"),
    ).not.toBeNull();
  });

  it("この端末でお祝い済みなら表示しない", () => {
    window.localStorage.setItem(
      "canshi:birthday-celebrated:cat-1:3",
      "2026-09-26T00:00:00.000Z",
    );
    render(<BirthdayCelebration cats={[buildCat()]} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("誕生日でない日は何も表示しない", () => {
    render(
      <BirthdayCelebration cats={[buildCat({ birthDate: "2023-09-27" })]} />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("生年月日が未設定なら何も表示しない", () => {
    render(<BirthdayCelebration cats={[buildCat({ birthDate: null })]} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("同じ日が誕生日の猫が複数いる場合は、閉じると次の猫を表示する", async () => {
    render(
      <BirthdayCelebration
        cats={[
          buildCat(),
          buildCat({ id: "cat-2", name: "みけ", birthDate: "2016-09-26" }),
        ]}
      />,
    );

    expect(
      await screen.findByText("今日はたまの3歳の誕生日です。"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(
      await screen.findByText("今日はみけの10歳の誕生日です。"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
