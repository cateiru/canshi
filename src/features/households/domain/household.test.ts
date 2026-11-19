import { describe, expect, it } from "vitest";
import { householdInvitationTokenFromUrl } from "./household";

const TOKEN = "abcDEF012_-xyz";

describe("householdInvitationTokenFromUrl", () => {
  it("招待 URL からトークンを取り出す", () => {
    expect(
      householdInvitationTokenFromUrl(
        `https://canshi.example.com/invitations/${TOKEN}`,
      ),
    ).toBe(TOKEN);
    expect(
      householdInvitationTokenFromUrl(
        `  https://canshi.example.com/invitations/${TOKEN}/  `,
      ),
    ).toBe(TOKEN);
  });

  it("パスやトークンだけの入力も受け付ける", () => {
    expect(householdInvitationTokenFromUrl(`/invitations/${TOKEN}`)).toBe(
      TOKEN,
    );
    expect(householdInvitationTokenFromUrl(TOKEN)).toBe(TOKEN);
  });

  it("クエリやハッシュが付いていてもトークンだけを取り出す", () => {
    expect(
      householdInvitationTokenFromUrl(
        `https://canshi.example.com/invitations/${TOKEN}?utm=1#top`,
      ),
    ).toBe(TOKEN);
  });

  it("招待 URL の形でなければ null", () => {
    expect(householdInvitationTokenFromUrl("")).toBeNull();
    expect(householdInvitationTokenFromUrl("   ")).toBeNull();
    expect(
      householdInvitationTokenFromUrl("https://canshi.example.com/cats"),
    ).toBeNull();
    expect(
      householdInvitationTokenFromUrl(
        `https://canshi.example.com/invitations/${TOKEN}/extra`,
      ),
    ).toBeNull();
    expect(
      householdInvitationTokenFromUrl(
        "https://canshi.example.com/invitations/%2E%2E",
      ),
    ).toBeNull();
    expect(householdInvitationTokenFromUrl("招待コード")).toBeNull();
    expect(householdInvitationTokenFromUrl(null)).toBeNull();
  });
});
