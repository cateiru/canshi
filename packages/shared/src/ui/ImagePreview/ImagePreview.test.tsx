import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImagePreview } from "./ImagePreview";

describe("ImagePreview", () => {
  it("サムネイルを遅延読み込みで表示する", () => {
    render(<ImagePreview src="/thumb.png" alt="たまの写真" />);

    const image = screen.getByRole("img", { name: "たまの写真" });
    expect(image).toHaveAttribute("src", "/thumb.png");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("画像がないときは代替表示を出し、fallbackLabel で読み上げる", () => {
    render(
      <ImagePreview
        src={null}
        alt="カリカリの画像"
        fallback={<svg data-testid="icon" />}
        fallbackLabel="カリカリの画像なし"
      />,
    );

    expect(
      screen.getByRole("img", { name: "カリカリの画像なし" }),
    ).toContainElement(screen.getByTestId("icon"));
  });

  it("previewSrc を指定すると、押したときにモーダルで元画像を表示する", () => {
    render(
      <ImagePreview
        src="/thumb.png"
        alt="たまの写真"
        previewSrc="/original.png"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "たまの写真を拡大して表示" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('img[src="/original.png"]')).toHaveAttribute(
      "alt",
      "たまの写真",
    );
  });

  it("alt が空でも、拡大表示のダイアログに既定のタイトルで名前を付ける", () => {
    render(<ImagePreview src="/thumb.png" alt="" previewSrc="/original.png" />);

    fireEvent.click(screen.getByRole("button", { name: "画像を拡大して表示" }));

    expect(screen.getByRole("dialog", { name: "画像" })).toBeInTheDocument();
  });
});
