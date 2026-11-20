import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import packageJson from "../../../package.json";
import { Breadcrumb, ButtonLink, Footer } from ".";

describe("Next.js のリンクを差し込んだコンポーネント", () => {
  it("ButtonLink は next/link でリンクを描く", () => {
    render(<ButtonLink href="/cats">ねこ</ButtonLink>);

    expect(screen.getByRole("link", { name: "ねこ" })).toHaveAttribute(
      "href",
      "/cats",
    );
  });

  it("Breadcrumb の replace を属性として出さない（next/link が扱う）", () => {
    render(
      <Breadcrumb
        items={[
          { label: "戻る", href: "/cats", replace: true },
          { label: "今" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "戻る" })).not.toHaveAttribute(
      "replace",
    );
  });

  it("Footer はこのアプリのバージョンを更新情報ページへのリンクで表示する", () => {
    render(<Footer />);

    expect(
      screen.getByRole("link", { name: `v${packageJson.version}` }),
    ).toHaveAttribute("href", "/release-notes");
  });
});
