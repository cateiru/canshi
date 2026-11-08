import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isDangerousDevelopmentLoginEnabled,
  isDevelopmentLoginEnabled,
} from "./developmentLogin";

const OIDC_ENV = {
  ACCESS_DISCOVERY_URL:
    "https://example.cloudflareaccess.com/.well-known/openid-configuration",
  ACCESS_CLIENT_ID: "client-id",
  ACCESS_CLIENT_SECRET: "client-secret",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDangerousDevelopmentLoginEnabled", () => {
  it('"true" のときだけ有効にする', () => {
    expect(
      isDangerousDevelopmentLoginEnabled({
        DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN: "true",
      }),
    ).toBe(true);
  });

  it.each([undefined, "", "false", "1", "TRUE"])(
    "%s では有効にしない",
    (value) => {
      expect(
        isDangerousDevelopmentLoginEnabled({
          DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN: value,
        }),
      ).toBe(false);
    },
  );
});

describe("isDevelopmentLoginEnabled", () => {
  it("本番ビルドでは、フラグがなければ OIDC が未設定でも使わない", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(isDevelopmentLoginEnabled({})).toBe(false);
    expect(
      isDevelopmentLoginEnabled({
        DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN: "false",
      }),
    ).toBe(false);
  });

  it("本番ビルドでも、フラグが有効なら使う（Worker Previews）", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(
      isDevelopmentLoginEnabled({
        DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN: "true",
      }),
    ).toBe(true);
  });

  it("フラグが有効なら、OIDC が設定されていても使う", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(
      isDevelopmentLoginEnabled({
        ...OIDC_ENV,
        DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN: "true",
      }),
    ).toBe(true);
  });

  it("開発環境では、OIDC が未設定のときだけ使う", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(isDevelopmentLoginEnabled({})).toBe(true);
    expect(isDevelopmentLoginEnabled(OIDC_ENV)).toBe(false);
  });
});
