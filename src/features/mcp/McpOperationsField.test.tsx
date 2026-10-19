import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { McpOperationsField } from "./McpOperationsField";

function renderField(
  allowedOperations: Parameters<
    typeof McpOperationsField
  >[0]["allowedOperations"] = [],
) {
  const { container } = render(
    <form>
      <McpOperationsField allowedOperations={allowedOperations} />
    </form>,
  );
  const input = container.querySelector<HTMLInputElement>(
    'input[name="mcpOperations"]',
  );
  return { value: () => JSON.parse(input?.value ?? "null") as string[] };
}

function operationCheckbox(group: string, label: string) {
  return within(screen.getByRole("group", { name: group })).getByRole(
    "checkbox",
    { name: label },
  );
}

describe("McpOperationsField", () => {
  it("許可していない操作はチェックが外れ、空の配列を送る", () => {
    const { value } = renderField();

    expect(operationCheckbox("記録", "追加")).not.toBeChecked();
    expect(operationCheckbox("ごはんのプリセット", "削除")).not.toBeChecked();
    expect(value()).toEqual([]);
  });

  it("チェックした操作を、決まった並び順で送る", () => {
    const { value } = renderField(["feedingPreset:delete"]);

    expect(operationCheckbox("ごはんのプリセット", "削除")).toBeChecked();
    fireEvent.click(operationCheckbox("記録", "追加"));

    expect(value()).toEqual(["record:create", "feedingPreset:delete"]);

    fireEvent.click(operationCheckbox("ごはんのプリセット", "削除"));
    expect(value()).toEqual(["record:create"]);
  });
});
