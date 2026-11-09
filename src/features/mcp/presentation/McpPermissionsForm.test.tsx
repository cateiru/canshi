import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MCP_PERMISSION_RECORD_TYPES,
  type McpPermissions,
  type McpPermissionTree,
} from "../domain/permissionRules";
import type { McpPermissionsFormState } from "./actions";
import { McpPermissionsForm } from "./McpPermissionsForm";

vi.mock("@/components/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui")>()),
  addToast: vi.fn(),
}));

const tree: McpPermissionTree = {
  households: [
    {
      id: "house-1",
      name: "家1",
      checked: true,
      operations: [],
      cats: [
        {
          id: "cat-1",
          name: "たま",
          checked: true,
          checkedRecordTypes: [...MCP_PERMISSION_RECORD_TYPES],
          writableRecordTypes: [],
        },
      ],
    },
  ],
  catalogOperations: null,
};

describe("McpPermissionsForm", () => {
  // React は action で送ったフォームを送信後に reset し、react-aria の Checkbox は reset で
  // マウント時の値に戻そうとする。保存した後も、選んだチェックのままにする（Issue #527）
  it("保存した後も、選んだチェックの状態のまま表示する", async () => {
    const action = vi.fn(
      async (_state: McpPermissionsFormState, _formData: FormData) => ({}),
    );
    render(<McpPermissionsForm action={action} tree={tree} />);
    const write = screen.getByRole("checkbox", { name: "家1の記録を書く" });
    expect(write).not.toBeChecked();

    fireEvent.click(write);
    expect(write).toBeChecked();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    });
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0]?.[1];
    const sent = JSON.parse(
      String(formData?.get("mcpPermissions")),
    ) as McpPermissions;
    expect(sent.writableRecordTypes["cat-1"]).toEqual([
      ...MCP_PERMISSION_RECORD_TYPES,
    ]);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "保存する" })).toBeEnabled(),
    );
    expect(write).toBeChecked();
  });
});
