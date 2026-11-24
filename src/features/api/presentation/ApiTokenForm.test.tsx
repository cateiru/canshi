import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionTree } from "@/features/external-access/domain/permissionRules";
import { ApiTokenForm } from "./ApiTokenForm";
import type { ApiTokenFormState } from "./actions";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@/features/navigation/useNavigateAfterSubmit", () => ({
  useNavigateAfterSubmit: () => navigate,
}));
// Server Action のモジュール（DB・Next.js に依存する）は読み込まない
vi.mock("./actions", () => ({}));

const tree: PermissionTree = { households: [], catalogOperations: [] };

function renderForm(result: ApiTokenFormState = {}, permissionTree = tree) {
  const action = vi.fn(
    async (_state: ApiTokenFormState, _formData: FormData) => result,
  );
  render(<ApiTokenForm action={action} tree={permissionTree} />);
  return action;
}

async function submit(name = "体重計との連携") {
  fireEvent.change(screen.getByLabelText("トークンの名前"), {
    target: { value: name },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "トークンを発行する" }));
  });
}

async function selectExpiration(label: string) {
  fireEvent.click(screen.getByRole("button", { name: /有効期限/ }));
  fireEvent.click(await screen.findByRole("option", { name: label }));
}

beforeEach(() => {
  navigate.mockClear();
});

describe("ApiTokenForm", () => {
  it("名前・有効期限・許可する範囲を送る", async () => {
    const action = renderForm();
    await submit();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("name")).toBe("体重計との連携");
    expect(formData.get("expiration")).toBe("30d");
    expect(JSON.parse(String(formData.get("mcpPermissions")))).toMatchObject({
      catalogOperations: [],
    });
  });

  it("期限なしを選ぶと、警告を表示する", async () => {
    const action = renderForm();
    expect(screen.queryByRole("alert")).toBeNull();

    await selectExpiration("期限なし");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "期限なしのトークンは、削除するまで使い続けられます",
    );
    await submit();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].get("expiration")).toBe("none");

    await selectExpiration("7日");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("発行したトークンをダイアログに表示し、閉じるとトークンの一覧へ移る", async () => {
    renderForm({ issued: { token: "canshi_issued", expiresAt: null } });
    await submit();

    const dialog = await screen.findByRole("dialog", {
      name: "トークンを発行しました",
    });
    expect(dialog).toHaveTextContent("有効期限: 期限なし");
    expect(screen.getByLabelText("API トークン")).toHaveValue("canshi_issued");

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(navigate).toHaveBeenCalledWith("/settings/api-tokens");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("家に所属していなければ、案内を表示して発行できないようにする", () => {
    renderForm({}, { households: [], catalogOperations: null });
    expect(screen.getByText(/所属している家がありません/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "トークンを発行する" }),
    ).toBeDisabled();
  });

  it("入力の間違いを表示する", async () => {
    renderForm({ fieldErrors: { name: ["トークンの名前を入力してください"] } });
    await submit(" ");
    expect(
      await screen.findByText("トークンの名前を入力してください"),
    ).toBeInTheDocument();
  });
});
