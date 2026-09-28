import { describe, expect, it } from "vitest";
import { formatBirthDate, toBirthDateFormDefaults } from "./birthDate";

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
