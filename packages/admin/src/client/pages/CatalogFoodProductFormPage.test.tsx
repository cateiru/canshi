import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { product } from "../test/fixtures";
import { currentLocation, renderApp, stubApi } from "../test/render";

function fill(label: string, value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: label }), {
    target: { value },
  });
}

describe("共通のごはん商品の登録・編集", () => {
  it("入力をフォームの項目にして送り、登録したら結果を一覧で表示する", async () => {
    let sent: FormData | null = null;
    stubApi({
      "POST /food-products": (init) => {
        sent = init?.body as FormData;
        return { status: 201, body: { id: "new-id" } };
      },
    });
    await renderApp("/food-products/new");
    fill("商品名", "まぐろ味 カリカリ");
    fill("カロリー（kcal/100g）", "380");
    fill("内容量（g）", "70");
    screen.getByRole("button", { name: "内容量を追加する" }).click();
    // 空の行は送らない
    await screen.findAllByRole("textbox", { name: "内容量（g）" });
    screen.getByRole("checkbox", { name: "シニア" }).click();
    screen.getByRole("checkbox", { name: "成猫" }).click();
    screen.getByRole("button", { name: "登録する" }).click();

    await screen.findByText(/^\/food-products\?/, { selector: "div[hidden]" });
    expect(currentLocation()).toBe(
      "/food-products?catalogChange=created&product=new-id",
    );
    const body = sent as FormData | null;
    expect(body?.get("name")).toBe("まぐろ味 カリカリ");
    expect(body?.getAll("packageAmountG")).toEqual(["70"]);
    expect(body?.getAll("packageUnit")).toEqual([""]);
    // 選んだ順ではなく決まった順にする
    expect(body?.getAll("lifeStages")).toEqual(["adult", "senior"]);
    expect(body?.get("nutritionType")).toBe("complete");
    expect(body?.get("amountUnit")).toBe("g");
    expect(body?.has("image")).toBe(false);
  });

  it("量の単位に ml を選ぶと、カロリー・内容量を ml で入力して送る", async () => {
    let sent: FormData | null = null;
    stubApi({
      "POST /food-products": (init) => {
        sent = init?.body as FormData;
        return { status: 201, body: { id: "new-id" } };
      },
    });
    await renderApp("/food-products/new");
    fill("商品名", "ねこのミルク");
    screen.getByRole("radio", { name: "ml（スープ・ミルクなど）" }).click();
    // 選んだ単位に合わせて見出しが変わる
    await screen.findByRole("textbox", { name: "カロリー（kcal/100ml）" });
    fill("カロリー（kcal/100ml）", "60");
    fill("内容量（ml）", "200");
    screen.getByRole("button", { name: "登録する" }).click();

    await screen.findByText(/^\/food-products\?/, { selector: "div[hidden]" });
    const body = sent as FormData | null;
    expect(body?.get("amountUnit")).toBe("ml");
    expect(body?.get("kcalPer100g")).toBe("60");
    expect(body?.getAll("packageAmountG")).toEqual(["200"]);
  });

  it("入力に誤りがあれば、サーバーが返したエラーを入力欄ごとに表示する", async () => {
    stubApi({
      "POST /food-products": () => ({
        status: 400,
        body: {
          errors: {
            name: "商品名を入力してください",
            packageSizes: "内容量を確かめてください",
            packageSizeRows: [{ amountG: "同じ内容量がすでにあります" }],
          },
        },
      }),
    });
    await renderApp("/food-products/new");
    fill("商品名", "x");
    fill("カロリー（kcal/100g）", "380");
    screen.getByRole("button", { name: "登録する" }).click();

    expect(
      await screen.findByText("入力内容を確かめてください。"),
    ).toBeInTheDocument();
    expect(screen.getByText("商品名を入力してください")).toBeInTheDocument();
    expect(screen.getByText("同じ内容量がすでにあります")).toBeInTheDocument();
    expect(currentLocation()).toBe("/food-products/new");
  });

  it("編集では今の値を入力欄に入れ、更新を送る", async () => {
    let method: string | undefined;
    stubApi({
      "GET /food-products/p-1": {
        product: product({
          id: "p-1",
          name: "まぐろ味 カリカリ",
          packageSizes: [
            { amountG: 40, unit: "袋" },
            { amountG: 160, unit: null },
          ],
          searchKeywords: ["ちゅーる", "ちゃおちゅーる"],
          imageAssetId: "asset-1",
        }),
      },
      "PUT /food-products/p-1": (init) => {
        method = init?.method;
        return { status: 200, body: { id: "p-1" } };
      },
    });
    await renderApp("/food-products/p-1/edit");
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "まぐろ味 カリカリ を編集する",
      }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("textbox", { name: "内容量（g）" })
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(["40", "160"]);
    expect(
      screen.getByRole("textbox", { name: "検索キーワード（任意）" }),
    ).toHaveValue("ちゅーる\nちゃおちゅーる");
    expect(screen.getByAltText("今の商品画像")).toHaveAttribute(
      "src",
      "/api/food-products/p-1/image?v=asset-1",
    );
    expect(
      screen.getByRole("checkbox", { name: "今の画像を削除する" }),
    ).toBeInTheDocument();

    screen.getByRole("button", { name: "更新する" }).click();
    await screen.findByText(/catalogChange=updated/, {
      selector: "div[hidden]",
    });
    expect(method).toBe("PUT");
  });

  it("存在しない商品は見つからないと表示する", async () => {
    stubApi({});
    await renderApp("/food-products/missing/edit");
    expect(
      screen.getByRole("heading", { level: 2, name: "ページが見つかりません" }),
    ).toBeInTheDocument();
  });
});
