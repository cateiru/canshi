import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRODUCTS } from "../test/fixtures";
import { renderApp, stubApi } from "../test/render";

/** メーカーごとのまとまりの開閉ボタン（見出しの中） */
function groupTrigger(name: string) {
  return screen.getByRole("button", { name: new RegExp(`^${name}`) });
}

describe("共通のごはん商品の一覧", () => {
  it("メーカーごとに閉じてまとめ、閉じたまとまりの中身は描かない", async () => {
    stubApi({ "GET /food-products": PRODUCTS });
    await renderApp("/food-products");

    const triggers = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    // メーカー名のない商品は最後にまとめる
    expect(triggers).toEqual([
      "いぬフード1 件",
      "ねこフード2 件",
      "メーカー名なし1 件",
    ]);
    for (const name of ["いぬフード", "ねこフード", "メーカー名なし"]) {
      expect(groupTrigger(name)).toHaveAttribute("aria-expanded", "false");
    }
    // 商品が数百件あっても DOM を大きくしないよう、閉じたまとまりの表は描かない
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("まぐろ味 カリカリ")).toBeNull();
  });

  it("開いたまとまりの商品を表に並べる", async () => {
    stubApi({ "GET /food-products": PRODUCTS });
    await renderApp("/food-products");
    groupTrigger("ねこフード").click();

    const table = await screen.findByRole("table", {
      name: "ねこフードの共通のごはん商品",
    });
    expect(within(table).getByText("まぐろ味 カリカリ")).toBeInTheDocument();
    expect(within(table).getByText("12.3 g/本")).toBeInTheDocument();
    // 1000g 以上は kg で表示する
    expect(within(table).getByText("1.5 kg")).toBeInTheDocument();
    expect(within(table).getByText("成猫・シニア")).toBeInTheDocument();
    expect(
      within(table).getByText("検索キーワード：Premium"),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("link", { name: "まぐろ味 カリカリを編集する" }),
    ).toHaveAttribute("href", "/food-products/p-1/edit");
  });

  it("検索したメーカーのまとまりを開き、商品名・検索キーワードで絞り込む", async () => {
    stubApi({ "GET /food-products": PRODUCTS });
    await renderApp(
      `/food-products?manufacturer=${encodeURIComponent("ねこフード")}&q=${encodeURIComponent(" まぐろ ")}`,
    );
    expect(groupTrigger("ねこフード")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("2 件中 1 件")).toBeInTheDocument();
    expect(screen.getByText("まぐろ味 カリカリ")).toBeInTheDocument();
    expect(screen.queryByText("かつお味 パウチ")).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveValue("まぐろ");
    // ほかのメーカーは閉じたまま
    expect(groupTrigger("メーカー名なし")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("検索キーワードでも絞り込め、英字の大文字・小文字は区別しない", async () => {
    stubApi({ "GET /food-products": PRODUCTS });
    await renderApp(
      `/food-products?manufacturer=${encodeURIComponent("ねこフード")}&q=premium`,
    );
    expect(screen.getByText("かつお味 パウチ")).toBeInTheDocument();
    expect(screen.queryByText("まぐろ味 カリカリ")).toBeNull();
  });

  it("メーカー名のない商品は、メーカーを空にして検索する", async () => {
    stubApi({ "GET /food-products": PRODUCTS });
    await renderApp(
      `/food-products?manufacturer=&q=${encodeURIComponent("まぐろ")}`,
    );
    expect(groupTrigger("メーカー名なし")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("1 件中 1 件")).toBeInTheDocument();
    expect(groupTrigger("ねこフード")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("一致する商品がなければそう表示する", async () => {
    stubApi({ "GET /food-products": PRODUCTS });
    await renderApp(
      `/food-products?manufacturer=${encodeURIComponent("ねこフード")}&q=${encodeURIComponent("ちゅーる")}`,
    );
    expect(screen.getByText("2 件中 0 件")).toBeInTheDocument();
    expect(
      screen.getByText("「ちゅーる」に一致する商品はありません。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("登録した商品のメーカーのまとまりを開き、結果を表示する", async () => {
    stubApi({ "GET /food-products": PRODUCTS });
    await renderApp("/food-products?catalogChange=created&product=p-3");
    expect(screen.getByRole("status")).toHaveTextContent(
      "とりささみ を登録しました。",
    );
    expect(groupTrigger("いぬフード")).toHaveAttribute("aria-expanded", "true");
    expect(groupTrigger("ねこフード")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("商品がなければそう表示する", async () => {
    stubApi({ "GET /food-products": { products: [] } });
    await renderApp("/food-products");
    expect(
      screen.getByText("共通のごはん商品はまだありません。"),
    ).toBeInTheDocument();
  });
});
