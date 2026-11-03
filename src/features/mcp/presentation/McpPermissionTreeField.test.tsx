import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MCP_PERMISSION_RECORD_TYPES,
  type McpPermissions,
  type McpPermissionTreeHousehold,
} from "../domain/permissionRules";
import { McpPermissionTreeField } from "./McpPermissionTreeField";

const allTypes = [...MCP_PERMISSION_RECORD_TYPES];

const tree: McpPermissionTreeHousehold[] = [
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
        checkedRecordTypes: allTypes,
        writableRecordTypes: [],
      },
      {
        id: "cat-2",
        name: "みけ",
        checked: true,
        checkedRecordTypes: allTypes,
        writableRecordTypes: [],
      },
    ],
  },
  {
    id: "house-2",
    name: "家2",
    checked: true,
    operations: [],
    cats: [],
  },
];

function renderField(initial = tree, { expand = true } = {}) {
  const { container } = render(
    <form>
      <McpPermissionTreeField tree={initial} />
    </form>,
  );
  if (expand) {
    expandAll(initial);
  }
  const input = container.querySelector<HTMLInputElement>(
    'input[name="mcpPermissions"]',
  );
  return {
    value: () => JSON.parse(input?.value ?? "null") as McpPermissions,
  };
}

/** 家の「詳細な設定」と、猫ごとの記録の種類をすべて開く */
function expandAll(households: McpPermissionTreeHousehold[]) {
  for (const household of households) {
    fireEvent.click(
      screen.getByRole("button", { name: `${household.name}の詳細な設定` }),
    );
    for (const cat of household.cats) {
      fireEvent.click(screen.getByRole("button", { name: cat.name }));
    }
  }
}

function checkbox(name: string) {
  return screen.getByRole("checkbox", { name });
}

/** 猫の記録の種類の「読む」のチェックボックス */
function recordCheckbox(catName: string, label: string) {
  return within(
    screen.getByRole("group", { name: `${catName}の記録` }),
  ).getByRole("checkbox", { name: `${label}を読む` });
}

/** 猫の記録の種類の「書く」のチェックボックス */
function writeCheckbox(catName: string, label: string) {
  return within(
    screen.getByRole("group", { name: `${catName}の記録` }),
  ).getByRole("checkbox", { name: `${label}を書く` });
}

/** 家ごとの操作のチェックボックス */
function operationCheckbox(
  householdName: string,
  group: string,
  label: string,
) {
  return within(
    screen.getByRole("group", { name: `${householdName}の${group}` }),
  ).getByRole("checkbox", { name: `${group}を${label}` });
}

const NOTHING_WRITABLE = {
  writableRecordTypes: {},
  householdOperations: {},
  catalogOperations: [],
};

describe("McpPermissionTreeField", () => {
  it("最初は読み取りにすべてチェックが付き、何も外さず、何も書き込めない値を送る", () => {
    const { value } = renderField();

    expect(checkbox("家1の記録を読む")).toBeChecked();
    expect(checkbox("たまの記録を読む")).toBeChecked();
    expect(recordCheckbox("たま", "ごはん")).toBeChecked();
    expect(writeCheckbox("たま", "ごはん")).not.toBeChecked();
    expect(operationCheckbox("家1", "ごはん商品", "読む")).not.toBeChecked();
    expect(screen.getByText("この家には猫がいません。")).toBeInTheDocument();
    expect(value()).toEqual({
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: {},
      ...NOTHING_WRITABLE,
    });
  });

  it("既定では詳細な設定と猫の記録の種類を閉じ、家の「読む」「書く」だけを表示する", () => {
    renderField(tree, { expand: false });

    expect(checkbox("家1の記録を読む")).toBeChecked();
    expect(checkbox("家1の記録を書く")).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "家1の詳細な設定" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("checkbox", { name: "たまの記録を読む" }),
    ).toBeNull();
    expect(screen.queryByRole("group", { name: "たまの記録" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "家1の詳細な設定" }));

    expect(checkbox("たまの記録を読む")).toBeChecked();
    expect(operationCheckbox("家1", "ごはん商品", "読む")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "たま" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("group", { name: "たまの記録" })).toBeNull();
  });

  it("閉じたまま家の「書く」を付けると、すべての猫の記録を書けるようにし、外すと読み取りだけを残す", () => {
    const { value } = renderField(tree, { expand: false });

    fireEvent.click(checkbox("家1の記録を読む"));
    fireEvent.click(checkbox("家1の記録を書く"));

    expect(checkbox("家1の記録を読む")).toBeChecked();
    expect(checkbox("家1の記録を書く")).toBeChecked();
    // 家の「書く」は記録だけで、家ごとの操作は許可しない
    expect(value()).toEqual({
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: {},
      writableRecordTypes: { "cat-1": allTypes, "cat-2": allTypes },
      householdOperations: {},
      catalogOperations: [],
    });

    expandAll(tree);
    expect(checkbox("たまの記録を書く")).toBeChecked();
    expect(writeCheckbox("みけ", "支出")).toBeChecked();
    expect(operationCheckbox("家1", "ごはん商品", "追加")).not.toBeChecked();

    fireEvent.click(checkbox("家1の記録を書く"));

    expect(checkbox("家1の記録を読む")).toBeChecked();
    expect(writeCheckbox("みけ", "支出")).not.toBeChecked();
    expect(value()).toEqual({
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: {},
      ...NOTHING_WRITABLE,
    });
  });

  it("一部の記録だけを書けるときは、猫・家の「書く」を「一部」の表示にし、猫の「書く」で猫の記録をすべて書けるようにする", () => {
    const { value } = renderField();

    fireEvent.click(writeCheckbox("たま", "ごはん"));

    expect(checkbox("たまの記録を書く")).toBePartiallyChecked();
    expect(checkbox("家1の記録を書く")).toBePartiallyChecked();
    expect(checkbox("みけの記録を書く")).not.toBeChecked();

    fireEvent.click(checkbox("たまの記録を書く"));

    expect(checkbox("たまの記録を書く")).toBeChecked();
    expect(checkbox("家1の記録を書く")).toBePartiallyChecked();
    expect(value().writableRecordTypes).toEqual({ "cat-1": allTypes });
  });

  it("猫がいない家では、家の「書く」を選べない", () => {
    renderField(tree, { expand: false });

    expect(checkbox("家2の記録を書く")).toBeDisabled();
  });

  it("「書く」にチェックすると読み取りにも付き、「読む」を外すと書き込みも外れる", () => {
    const { value } = renderField();

    fireEvent.click(recordCheckbox("たま", "うんち"));
    fireEvent.click(writeCheckbox("たま", "うんち"));
    fireEvent.click(writeCheckbox("たま", "ごはん"));

    expect(recordCheckbox("たま", "うんち")).toBeChecked();
    expect(value().writableRecordTypes).toEqual({
      "cat-1": ["feeding", "poop"],
    });

    fireEvent.click(recordCheckbox("たま", "ごはん"));

    expect(writeCheckbox("たま", "ごはん")).not.toBeChecked();
    expect(value().writableRecordTypes).toEqual({ "cat-1": ["poop"] });
  });

  it("猫・家のチェックを外すと、書き込み・操作も外れ、付け直しても書き込みには付かない", () => {
    const { value } = renderField();

    fireEvent.click(writeCheckbox("たま", "ごはん"));
    fireEvent.click(operationCheckbox("家1", "ごはん商品", "追加"));
    fireEvent.click(checkbox("家1の記録を読む"));
    fireEvent.click(checkbox("家1の記録を読む"));

    expect(writeCheckbox("たま", "ごはん")).not.toBeChecked();
    expect(operationCheckbox("家1", "ごはん商品", "追加")).not.toBeChecked();
    expect(value()).toMatchObject(NOTHING_WRITABLE);
  });

  it("家の操作にチェックすると、その家の操作として送る", () => {
    const { value } = renderField();

    fireEvent.click(operationCheckbox("家1", "ごはんのプリセット", "削除"));
    fireEvent.click(operationCheckbox("家1", "ごはん商品", "読む"));

    expect(value().householdOperations).toEqual({
      "house-1": ["foodProduct:read", "feedingPreset:delete"],
    });
  });

  it("記録の種類を外すと、親の猫・家は「一部」の表示になる", () => {
    const { value } = renderField();

    fireEvent.click(recordCheckbox("たま", "うんち"));

    expect(recordCheckbox("たま", "うんち")).not.toBeChecked();
    expect(checkbox("たまの記録を読む")).toBePartiallyChecked();
    expect(checkbox("家1の記録を読む")).toBePartiallyChecked();
    expect(value().excludedRecordTypes).toEqual({ "cat-1": ["poop"] });
  });

  it("親のチェックを外すと子のチェックも外れ、付け直すと子にもすべて付く", () => {
    const { value } = renderField();

    fireEvent.click(checkbox("家1の記録を読む"));

    expect(checkbox("家1の記録を読む")).not.toBeChecked();
    expect(checkbox("たまの記録を読む")).not.toBeChecked();
    expect(checkbox("みけの記録を読む")).not.toBeChecked();
    expect(recordCheckbox("たま", "ごはん")).not.toBeChecked();
    // 家を外したときは、猫が別の家へ引っ越しても読み取れないよう猫も外したものとして送る。
    // 記録の種類は猫に含まれるため送らない
    expect(value()).toEqual({
      excludedHouseholdIds: ["house-1"],
      excludedCatIds: ["cat-1", "cat-2"],
      excludedRecordTypes: {},
      ...NOTHING_WRITABLE,
    });

    fireEvent.click(checkbox("家1の記録を読む"));

    expect(checkbox("家1の記録を読む")).toBeChecked();
    expect(checkbox("みけの記録を読む")).toBeChecked();
    expect(recordCheckbox("みけ", "支出")).toBeChecked();
    expect(value()).toEqual({
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: {},
      ...NOTHING_WRITABLE,
    });
  });

  it("子にチェックを付けると、親にもチェックが付く", () => {
    const { value } = renderField();

    fireEvent.click(checkbox("家1の記録を読む"));
    fireEvent.click(recordCheckbox("みけ", "体重"));

    expect(checkbox("家1の記録を読む")).toBePartiallyChecked();
    expect(checkbox("みけの記録を読む")).toBePartiallyChecked();
    expect(checkbox("たまの記録を読む")).not.toBeChecked();
    expect(value()).toEqual({
      excludedHouseholdIds: [],
      excludedCatIds: ["cat-1"],
      excludedRecordTypes: {
        "cat-2": MCP_PERMISSION_RECORD_TYPES.filter(
          (type) => type !== "weight",
        ),
      },
      ...NOTHING_WRITABLE,
    });
  });

  it("「一部」の表示の親を押すと、子にすべてチェックが付く", () => {
    renderField([
      {
        ...tree[0],
        cats: [
          {
            id: "cat-1",
            name: "たま",
            checked: true,
            checkedRecordTypes: [],
            writableRecordTypes: [],
          },
        ],
      },
    ]);
    expect(checkbox("たまの記録を読む")).toBePartiallyChecked();

    fireEvent.click(checkbox("たまの記録を読む"));

    expect(checkbox("たまの記録を読む")).toBeChecked();
    expect(recordCheckbox("たま", "ごはん")).toBeChecked();
  });

  it("家が無いときは、案内だけを表示して値を送らない", () => {
    const { container } = render(<McpPermissionTreeField tree={[]} />);

    expect(screen.getByText(/所属している家がありません/)).toBeInTheDocument();
    expect(container.querySelector('input[name="mcpPermissions"]')).toBeNull();
  });

  it("admin でなければ、共通のごはん商品の操作を表示しない", () => {
    renderField();

    expect(
      screen.queryByRole("group", { name: "共通のごはん商品" }),
    ).toBeNull();
  });

  it("共通のごはん商品の操作は、家とは別に、チェックしたものを許可したものとして送る", () => {
    const { container } = render(
      <McpPermissionTreeField
        tree={tree}
        catalogOperations={["catalogFoodProduct:read"]}
      />,
    );
    const value = () =>
      JSON.parse(
        container.querySelector<HTMLInputElement>(
          'input[name="mcpPermissions"]',
        )?.value ?? "null",
      ) as McpPermissions;
    const catalog = within(
      screen.getByRole("group", { name: "共通のごはん商品" }),
    );

    expect(
      catalog.getByRole("checkbox", { name: "共通のごはん商品を読む" }),
    ).toBeChecked();
    fireEvent.click(
      catalog.getByRole("checkbox", { name: "共通のごはん商品を編集" }),
    );
    fireEvent.click(
      catalog.getByRole("checkbox", {
        name: "共通のごはん商品のリクエストを完了",
      }),
    );
    // 家を外しても、共通のごはん商品の操作は外れない
    fireEvent.click(checkbox("家1の記録を読む"));

    expect(value().catalogOperations).toEqual([
      "catalogFoodProduct:read",
      "catalogFoodProduct:update",
      "catalogFoodProductRequest:complete",
    ]);
  });

  it("家が無くても admin なら、共通のごはん商品の操作を選べる", () => {
    const { container } = render(
      <McpPermissionTreeField tree={[]} catalogOperations={[]} />,
    );

    expect(screen.getByText(/所属している家がありません/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "共通のごはん商品を追加" }),
    );
    expect(
      JSON.parse(
        container.querySelector<HTMLInputElement>(
          'input[name="mcpPermissions"]',
        )?.value ?? "null",
      ),
    ).toMatchObject({ catalogOperations: ["catalogFoodProduct:create"] });
  });
});
