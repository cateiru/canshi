import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { McpPermissionTreeField } from "./McpPermissionTreeField";
import {
  MCP_PERMISSION_RECORD_TYPES,
  type McpPermissions,
  type McpPermissionTreeHousehold,
} from "./permissionRules";

const allTypes = [...MCP_PERMISSION_RECORD_TYPES];

const tree: McpPermissionTreeHousehold[] = [
  {
    id: "house-1",
    name: "家1",
    checked: true,
    cats: [
      {
        id: "cat-1",
        name: "たま",
        checked: true,
        checkedRecordTypes: allTypes,
      },
      {
        id: "cat-2",
        name: "みけ",
        checked: true,
        checkedRecordTypes: allTypes,
      },
    ],
  },
  {
    id: "house-2",
    name: "家2",
    checked: true,
    cats: [],
  },
];

function renderField(initial = tree) {
  const { container } = render(
    <form>
      <McpPermissionTreeField tree={initial} />
    </form>,
  );
  const input = container.querySelector<HTMLInputElement>(
    'input[name="mcpPermissions"]',
  );
  return {
    value: () => JSON.parse(input?.value ?? "null") as McpPermissions,
  };
}

function checkbox(name: string) {
  return screen.getByRole("checkbox", { name });
}

function recordCheckbox(catName: string, label: string) {
  return within(
    screen.getByRole("group", { name: `${catName}の記録` }),
  ).getByRole("checkbox", { name: label });
}

describe("McpPermissionTreeField", () => {
  it("最初はすべてにチェックが付き、何も外していない値を送る", () => {
    const { value } = renderField();

    expect(checkbox("家1")).toBeChecked();
    expect(checkbox("たま")).toBeChecked();
    expect(recordCheckbox("たま", "ごはん")).toBeChecked();
    expect(screen.getByText("この家には猫がいません。")).toBeInTheDocument();
    expect(value()).toEqual({
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: {},
    });
  });

  it("記録の種類を外すと、親の猫・家は「一部」の表示になる", () => {
    const { value } = renderField();

    fireEvent.click(recordCheckbox("たま", "うんち"));

    expect(recordCheckbox("たま", "うんち")).not.toBeChecked();
    expect(checkbox("たま")).toBePartiallyChecked();
    expect(checkbox("家1")).toBePartiallyChecked();
    expect(value().excludedRecordTypes).toEqual({ "cat-1": ["poop"] });
  });

  it("親のチェックを外すと子のチェックも外れ、付け直すと子にもすべて付く", () => {
    const { value } = renderField();

    fireEvent.click(checkbox("家1"));

    expect(checkbox("家1")).not.toBeChecked();
    expect(checkbox("たま")).not.toBeChecked();
    expect(checkbox("みけ")).not.toBeChecked();
    expect(recordCheckbox("たま", "ごはん")).not.toBeChecked();
    // 親を外したときは、子は親に含まれるため送らない
    expect(value()).toEqual({
      excludedHouseholdIds: ["house-1"],
      excludedCatIds: [],
      excludedRecordTypes: {},
    });

    fireEvent.click(checkbox("家1"));

    expect(checkbox("家1")).toBeChecked();
    expect(checkbox("みけ")).toBeChecked();
    expect(recordCheckbox("みけ", "支出")).toBeChecked();
    expect(value().excludedHouseholdIds).toEqual([]);
  });

  it("子にチェックを付けると、親にもチェックが付く", () => {
    const { value } = renderField();

    fireEvent.click(checkbox("家1"));
    fireEvent.click(recordCheckbox("みけ", "体重"));

    expect(checkbox("家1")).toBePartiallyChecked();
    expect(checkbox("みけ")).toBePartiallyChecked();
    expect(checkbox("たま")).not.toBeChecked();
    expect(value()).toEqual({
      excludedHouseholdIds: [],
      excludedCatIds: ["cat-1"],
      excludedRecordTypes: {
        "cat-2": MCP_PERMISSION_RECORD_TYPES.filter(
          (type) => type !== "weight",
        ),
      },
    });
  });

  it("「一部」の表示の親を押すと、子にすべてチェックが付く", () => {
    renderField([
      {
        ...tree[0],
        cats: [
          { id: "cat-1", name: "たま", checked: true, checkedRecordTypes: [] },
        ],
      },
    ]);
    expect(checkbox("たま")).toBePartiallyChecked();

    fireEvent.click(checkbox("たま"));

    expect(checkbox("たま")).toBeChecked();
    expect(recordCheckbox("たま", "ごはん")).toBeChecked();
  });

  it("家が無いときは、案内だけを表示して値を送らない", () => {
    const { container } = render(<McpPermissionTreeField tree={[]} />);

    expect(screen.getByText(/所属している家がありません/)).toBeInTheDocument();
    expect(container.querySelector('input[name="mcpPermissions"]')).toBeNull();
  });
});
