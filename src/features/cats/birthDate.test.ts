import { describe, expect, it } from "vitest";
import {
  formatBirthDate,
  toBirthDateFormDefaults,
  withSubmittedBirthDate,
} from "./birthDate";

describe("formatBirthDate", () => {
  it("年月日すべてわかる場合は日付をそのまま表示する", () => {
    expect(formatBirthDate("2020-04-01", "day")).toBe("2020-04-01");
  });

  it("年月のみの場合は日を表示しない", () => {
    expect(formatBirthDate("2020-04-01", "month")).toBe("2020年4月");
  });

  it("年のみの場合は月・日を表示しない", () => {
    expect(formatBirthDate("2020-01-01", "year")).toBe("2020年");
  });
});

describe("toBirthDateFormDefaults", () => {
  it("生年月日が未設定の場合は空にする", () => {
    expect(toBirthDateFormDefaults(null, "day")).toEqual({
      birthDate: "",
      birthYear: "",
      birthMonth: null,
    });
  });

  it("年月日すべてわかる場合は日付を初期値にする", () => {
    expect(toBirthDateFormDefaults("2020-04-15", "day")).toEqual({
      birthDate: "2020-04-15",
      birthYear: "2020",
      birthMonth: "4",
    });
  });

  it("年月のみの場合は補完した日を初期値にしない", () => {
    expect(toBirthDateFormDefaults("2020-04-01", "month")).toEqual({
      birthDate: "",
      birthYear: "2020",
      birthMonth: "4",
    });
  });

  it("年のみの場合は補完した月・日を初期値にしない", () => {
    expect(toBirthDateFormDefaults("2020-01-01", "year")).toEqual({
      birthDate: "",
      birthYear: "2020",
      birthMonth: null,
    });
  });
});

describe("withSubmittedBirthDate", () => {
  const saved = toBirthDateFormDefaults("2020-04-15", "day");

  it("送信した値を保存済みの値より優先する", () => {
    expect(
      withSubmittedBirthDate(saved, {
        precision: "month",
        birthYear: "2018",
        birthMonth: "7",
      }),
    ).toEqual({ birthDate: "2020-04-15", birthYear: "2018", birthMonth: "7" });
  });

  it("送信されなかった入力欄は保存済みの値のままにする", () => {
    expect(
      withSubmittedBirthDate(saved, { precision: "year", birthYear: "2018" }),
    ).toEqual({ birthDate: "2020-04-15", birthYear: "2018", birthMonth: "4" });
  });

  it("空にして送信した入力欄は空のままにする", () => {
    expect(
      withSubmittedBirthDate(saved, {
        precision: "month",
        birthYear: "",
        birthMonth: "",
      }),
    ).toEqual({ birthDate: "2020-04-15", birthYear: "", birthMonth: null });
  });
});
