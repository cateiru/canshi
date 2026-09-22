import { describe, expect, it } from "vitest";
import {
  addApprovedClient,
  generateCSRFProtection,
  isClientApproved,
  validateCSRFToken,
} from "./approval";

const SECRET = "test-secret";

function requestWithCookie(cookie: string): Request {
  return new Request("https://mcp.example.test/authorize", {
    headers: { Cookie: cookie },
  });
}

describe("CSRF protection", () => {
  it("accepts a form token that matches the cookie", () => {
    const { token, setCookie } = generateCSRFProtection();
    const cookieValue = setCookie.split(";")[0];
    const formData = new FormData();
    formData.set("csrf_token", token);

    const result = validateCSRFToken(formData, requestWithCookie(cookieValue));
    expect(result.clearCookie).toContain("Max-Age=0");
  });

  it("rejects a missing form token", () => {
    const { setCookie } = generateCSRFProtection();
    const cookieValue = setCookie.split(";")[0];
    const formData = new FormData();

    expect(() =>
      validateCSRFToken(formData, requestWithCookie(cookieValue)),
    ).toThrow();
  });

  it("rejects a token that doesn't match the cookie", () => {
    const { setCookie } = generateCSRFProtection();
    const cookieValue = setCookie.split(";")[0];
    const formData = new FormData();
    formData.set("csrf_token", "forged-token");

    expect(() =>
      validateCSRFToken(formData, requestWithCookie(cookieValue)),
    ).toThrow();
  });

  it("rejects when there is no CSRF cookie at all", () => {
    const formData = new FormData();
    formData.set("csrf_token", "some-token");

    expect(() =>
      validateCSRFToken(
        formData,
        new Request("https://mcp.example.test/authorize"),
      ),
    ).toThrow();
  });
});

describe("approved clients cookie", () => {
  it("is not approved before addApprovedClient is called", async () => {
    const approved = await isClientApproved(
      new Request("https://mcp.example.test/authorize"),
      "client-1",
      SECRET,
    );
    expect(approved).toBe(false);
  });

  it("round-trips: approving a client makes isClientApproved true", async () => {
    const setCookie = await addApprovedClient(
      new Request("https://mcp.example.test/authorize"),
      "client-1",
      SECRET,
    );
    const cookieValue = setCookie.split(";")[0];

    const approved = await isClientApproved(
      requestWithCookie(cookieValue),
      "client-1",
      SECRET,
    );
    expect(approved).toBe(true);

    // 承認していない別のクライアントは false のまま
    const otherApproved = await isClientApproved(
      requestWithCookie(cookieValue),
      "client-2",
      SECRET,
    );
    expect(otherApproved).toBe(false);
  });

  it("rejects a cookie signed with a different secret", async () => {
    const setCookie = await addApprovedClient(
      new Request("https://mcp.example.test/authorize"),
      "client-1",
      "other-secret",
    );
    const cookieValue = setCookie.split(";")[0];

    const approved = await isClientApproved(
      requestWithCookie(cookieValue),
      "client-1",
      SECRET,
    );
    expect(approved).toBe(false);
  });

  it("rejects a tampered cookie payload", async () => {
    const setCookie = await addApprovedClient(
      new Request("https://mcp.example.test/authorize"),
      "client-1",
      SECRET,
    );
    const [signature] = setCookie.split(";")[0].split("=")[1].split(".");
    const forgedPayload = btoa(JSON.stringify(["attacker-client"]));
    const forgedCookie = `__Host-APPROVED_CLIENTS=${signature}.${forgedPayload}`;

    const approved = await isClientApproved(
      requestWithCookie(forgedCookie),
      "attacker-client",
      SECRET,
    );
    expect(approved).toBe(false);
  });
});
