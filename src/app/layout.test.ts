import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHeaders } = vi.hoisted(() => ({ mockHeaders: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mockHeaders }));

import { generateMetadata } from "./layout";

describe("共有画像のメタデータ", () => {
  beforeEach(() => {
    mockHeaders.mockReset();
  });

  it("アクセス先のホストを画像 URL の基準にする", async () => {
    mockHeaders.mockResolvedValue(new Headers({ host: "cats.example.test" }));

    const metadata = await generateMetadata();

    expect(metadata.metadataBase?.toString()).toBe(
      "https://cats.example.test/",
    );
    expect(metadata.twitter).toEqual({ card: "summary_large_image" });
  });

  it("プロキシ経由では転送されたホストを使う", async () => {
    mockHeaders.mockResolvedValue(
      new Headers({
        host: "internal:3000",
        "x-forwarded-host": "shared.example.test",
        "x-forwarded-proto": "https",
      }),
    );

    const metadata = await generateMetadata();

    expect(metadata.metadataBase?.toString()).toBe(
      "https://shared.example.test/",
    );
  });

  it("ローカルの HTTP とポート番号を保つ", async () => {
    mockHeaders.mockResolvedValue(
      new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" }),
    );

    const metadata = await generateMetadata();

    expect(metadata.metadataBase?.toString()).toBe("http://localhost:3000/");
  });
});
