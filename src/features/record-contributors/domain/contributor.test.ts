import { describe, expect, it } from "vitest";
import { formatRecordContributorLabel } from "./contributor";

describe("formatRecordContributorLabel", () => {
  it("ユーザーは名前を返す", () => {
    expect(
      formatRecordContributorLabel({
        kind: "user",
        userName: "たろう",
        iconMediaAssetId: null,
      }),
    ).toBe("たろう");
  });

  it("AI のアプリは、アプリの名前と接続したユーザーを返す", () => {
    expect(
      formatRecordContributorLabel({
        kind: "ai",
        userName: "たろう",
        clientName: "ChatGPT",
        app: "openai",
      }),
    ).toBe("ChatGPT（たろうが接続）");
  });

  it("名前がわからない AI のアプリは、共通の名前にする", () => {
    expect(
      formatRecordContributorLabel({
        kind: "ai",
        userName: "たろう",
        clientName: null,
        app: null,
      }),
    ).toBe("AIのアプリ（たろうが接続）");
  });
});
