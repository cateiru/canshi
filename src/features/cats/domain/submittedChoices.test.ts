import { describe, expect, it } from "vitest";
import { readSubmittedCatChoices } from "./submittedChoices";

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) {
    data.set(name, value);
  }
  return data;
}

describe("readSubmittedCatChoices", () => {
  it("送信された選択をそのまま返す", () => {
    expect(
      readSubmittedCatChoices(
        formData({
          sex: "male",
          neuterStatus: "neutered",
          coatColor: "red",
        }),
      ),
    ).toEqual({
      sex: "male",
      neuterStatus: "neutered",
      coatColor: "red",
    });
  });

  it("未設定（空文字）と不正な値は null にする", () => {
    expect(
      readSubmittedCatChoices(
        formData({
          sex: "unknown",
          neuterStatus: "",
          coatColor: "rainbow",
        }),
      ),
    ).toEqual({
      sex: "unknown",
      neuterStatus: null,
      coatColor: null,
    });
  });

  it("性別が送信されなかった・不正な場合は undefined にする", () => {
    expect(readSubmittedCatChoices(formData({})).sex).toBeUndefined();
    expect(
      readSubmittedCatChoices(formData({ sex: "other" })).sex,
    ).toBeUndefined();
  });
});
