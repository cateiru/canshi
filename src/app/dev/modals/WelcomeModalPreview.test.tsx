import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WelcomeModalPreview } from "./WelcomeModalPreview";

function openWelcomeModal() {
  render(<WelcomeModalPreview />);
  fireEvent.click(
    screen.getByRole("button", { name: "ウェルカムモーダルを開く" }),
  );
}

describe("WelcomeModalPreview", () => {
  it("「もっていない」を選ぶと、モーダルを閉じて結果を表示する", async () => {
    openWelcomeModal();
    expect(
      screen.getByRole("dialog", {
        name: "アカウントを作成いただきありがとうございます！",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "もっていない" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "「もっていない」を選びました。",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("招待URLの形でなければ、モーダルのままエラーを出す", async () => {
    openWelcomeModal();
    fireEvent.click(screen.getByRole("button", { name: "もっている" }));
    fireEvent.change(screen.getByRole("textbox", { name: "招待URL" }), {
      target: { value: "https://example.com/not-invitation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    expect(
      await screen.findByText(
        "招待URLの形式が正しくありません。届いた招待URLをそのまま貼り付けてください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("招待URLを適用すると、モーダルを閉じて移る先を表示する", async () => {
    openWelcomeModal();
    fireEvent.click(screen.getByRole("button", { name: "もっている" }));
    fireEvent.change(screen.getByRole("textbox", { name: "招待URL" }), {
      target: { value: "https://canshi.example/invitations/abc123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("/invitations/abc123");
  });
});
