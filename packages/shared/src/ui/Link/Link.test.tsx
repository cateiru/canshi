import { render, screen } from "@testing-library/react";
import { TbPlus } from "react-icons/tb";
import { describe, expect, it } from "vitest";
import { Breadcrumb } from "../Breadcrumb/Breadcrumb";
import { ButtonLink } from "../Button/ButtonLink";
import { IconButtonLink } from "../Button/IconButtonLink";
import { FilterTabs } from "../FilterTabs/FilterTabs";
import { Footer } from "../Footer/Footer";
import { MonthNav } from "../MonthNav/MonthNav";
import { NavCard } from "../NavCard/NavCard";
import { Pagination } from "../Pagination/Pagination";
import { AnchorLink, type LinkProps } from "./Link";

/** 渡された props を data 属性に写して、linkComponent が使われたことを確かめるリンク */
function TestLink({ replace, transitionTypes, ...props }: LinkProps) {
  return (
    <a
      data-test-link=""
      data-replace={replace ? "true" : undefined}
      data-transition-types={transitionTypes?.join(" ")}
      {...props}
    />
  );
}

describe("AnchorLink", () => {
  it("素の <a> で描き、replace・transitionTypes は属性に出さない", () => {
    render(
      <AnchorLink href="/cats" replace transitionTypes={["next"]}>
        ねこ
      </AnchorLink>,
    );

    const link = screen.getByRole("link", { name: "ねこ" });
    expect(link).toHaveAttribute("href", "/cats");
    expect(link).not.toHaveAttribute("replace");
    expect(link).not.toHaveAttribute("transitionTypes");
  });
});

describe("linkComponent", () => {
  it("省略すると素の <a> で描く", () => {
    render(<ButtonLink href="/cats">ねこ</ButtonLink>);

    const link = screen.getByRole("link", { name: "ねこ" });
    expect(link).toHaveAttribute("href", "/cats");
    expect(link).not.toHaveAttribute("data-test-link");
  });

  it("渡したコンポーネントで、リンクを含むコンポーネントのリンクを描く", () => {
    render(
      <>
        <ButtonLink href="/a" linkComponent={TestLink}>
          ボタンのリンク
        </ButtonLink>
        <IconButtonLink
          href="/b"
          icon={TbPlus}
          aria-label="アイコンのリンク"
          linkComponent={TestLink}
        />
        <NavCard href="/c" title="カード" linkComponent={TestLink} />
        <Breadcrumb
          items={[
            { label: "パンくず", href: "/d", replace: true },
            { label: "今のページ" },
          ]}
          linkComponent={TestLink}
        />
        <FilterTabs
          items={[{ key: "all", href: "/e", label: "タブ" }]}
          selectedKey="all"
          aria-label="絞り込み"
          linkComponent={TestLink}
        />
        <Footer version="1.2.3" linkComponent={TestLink} />
        <Pagination
          page={1}
          totalPages={2}
          getHref={(page) => `/f?page=${page}`}
          linkComponent={TestLink}
        />
        <MonthNav
          year={2026}
          month={11}
          prevHref="/g?ym=2026-10"
          nextHref="/g?ym=2026-12"
          transitionTypes={{ prev: ["prev"], next: ["next"] }}
          linkComponent={TestLink}
        />
      </>,
    );

    const links = screen.getAllByRole("link");
    // フッターの cateiru.com は外部のリンクのため、素の <a> のまま
    const external = screen.getByRole("link", { name: "cateiru" });
    for (const link of links.filter((link) => link !== external)) {
      expect(link).toHaveAttribute("data-test-link");
    }
    expect(external).not.toHaveAttribute("data-test-link");

    // 移動の仕方のヒントも、渡したコンポーネントに届く
    expect(screen.getByRole("link", { name: "パンくず" })).toHaveAttribute(
      "data-replace",
      "true",
    );
    expect(screen.getByRole("link", { name: "次の月" })).toHaveAttribute(
      "data-transition-types",
      "next",
    );
  });
});
