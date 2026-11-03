// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_EMAIL_HASH_SALT,
  getEmailHashSalt,
  hashEmail,
  normalizeEmail,
} from "./emailHash";

const SALT = "test-salt-0123456789";

describe("hashEmail", () => {
  it("同じメールアドレス・SALT からは常に同じ値になる（パラメータを変えると一致しなくなる）", () => {
    // 運用中のユーザーのハッシュと一致しなくなるため、この値が変わる変更はしない
    expect(hashEmail("owner@example.com", SALT)).toBe(
      "ecdd419a7664dffe11278b0459d6ee0f130ef1b84893561c38555452964d8b45",
    );
  });

  it("大文字・小文字や前後の空白の違いは同じメールアドレスとして扱う", () => {
    expect(hashEmail("  Owner@Example.COM ", SALT)).toBe(
      hashEmail("owner@example.com", SALT),
    );
  });

  it("SALT やメールアドレスが違えば別の値になる", () => {
    const hash = hashEmail("owner@example.com", SALT);
    expect(hashEmail("owner@example.com", `${SALT}-other`)).not.toBe(hash);
    expect(hashEmail("family@example.com", SALT)).not.toBe(hash);
  });

  it("e2e・VRT の seed（e2e/fixtures/vrt-seed.sql）のハッシュと一致する", () => {
    expect(hashEmail("e2e@example.com", DEVELOPMENT_EMAIL_HASH_SALT)).toBe(
      "67534d9e2c2cbdba8b5cc51b13f29cda8a204335369ea791404d411d86e9a59e",
    );
  });
});

describe("normalizeEmail", () => {
  it("前後の空白を除いて小文字にする", () => {
    expect(normalizeEmail(" Foo@Example.com\n")).toBe("foo@example.com");
  });
});

describe("getEmailHashSalt", () => {
  it("設定された SALT を返す", () => {
    expect(getEmailHashSalt(SALT, { allowDevelopmentSalt: false })).toBe(SALT);
  });

  it("未設定ならエラーにする", () => {
    expect(() =>
      getEmailHashSalt(undefined, { allowDevelopmentSalt: false }),
    ).toThrow("EMAIL_HASH_SALT が設定されていません");
    expect(() => getEmailHashSalt("", { allowDevelopmentSalt: false })).toThrow(
      "EMAIL_HASH_SALT が設定されていません",
    );
  });

  it("開発環境では未設定でも開発用の SALT を使う", () => {
    expect(getEmailHashSalt(undefined, { allowDevelopmentSalt: true })).toBe(
      DEVELOPMENT_EMAIL_HASH_SALT,
    );
  });

  it("短すぎる SALT はエラーにする", () => {
    expect(() =>
      getEmailHashSalt("short", { allowDevelopmentSalt: true }),
    ).toThrow("16 文字以上");
  });
});
