import { headers } from "next/headers";

/**
 * アクセス先のオリジン（`https://canshi.example.com` など）。固定の公開 URL を持たないため、
 * ヘルプに載せる URL はアクセス先のドメインから組み立てる
 */
export async function requestOrigin() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") === "http" ? "http" : "https";
  return `${protocol}://${host}`;
}
