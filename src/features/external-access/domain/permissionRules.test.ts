// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  isTimelineAnniversaryType,
  TIMELINE_RECORD_TYPES,
} from "@/features/timeline/domain/timelineEntry";
import {
  type AccessPermissions,
  ALWAYS_ALLOWED_TIMELINE_TYPES,
  allowedRecordTypes,
  allowedWriteRecordTypes,
  buildPermissionTree,
  DEFAULT_PERMISSIONS,
  isCatAllowed,
  isCatalogOperationAllowed,
  isHouseholdOperationAllowed,
  PERMISSION_RECORD_TYPES,
  parsePermissionsInput,
} from "./permissionRules";

const permissions: AccessPermissions = {
  excludedHouseholdIds: ["house-2"],
  excludedCatIds: ["cat-2"],
  excludedRecordTypes: { "cat-1": ["poop", "expense"] },
  writableRecordTypes: { "cat-1": ["feeding", "poop"] },
  householdOperations: {
    "house-1": ["foodProduct:read"],
    "house-2": ["foodProduct:read"],
  },
  catalogOperations: ["catalogFoodProduct:read"],
};

describe("PERMISSION_RECORD_TYPES", () => {
  it("タイムラインの記録の種類のうち、記念日以外をすべて含む", () => {
    expect(PERMISSION_RECORD_TYPES).toEqual(
      TIMELINE_RECORD_TYPES.filter((type) => !isTimelineAnniversaryType(type)),
    );
    expect(ALWAYS_ALLOWED_TIMELINE_TYPES).toEqual(
      TIMELINE_RECORD_TYPES.filter(isTimelineAnniversaryType),
    );
  });
});

describe("isCatAllowed", () => {
  it("外した家の猫・外した猫・家の無い猫は読み取れない", () => {
    expect(
      isCatAllowed(permissions, { id: "cat-1", householdId: "house-1" }),
    ).toBe(true);
    expect(
      isCatAllowed(permissions, { id: "cat-3", householdId: "house-2" }),
    ).toBe(false);
    expect(
      isCatAllowed(permissions, { id: "cat-2", householdId: "house-1" }),
    ).toBe(false);
    expect(
      isCatAllowed(DEFAULT_PERMISSIONS, {
        id: "cat-1",
        householdId: null,
      }),
    ).toBe(false);
  });
});

describe("allowedRecordTypes", () => {
  it("外した記録の種類を除き、ほかの猫には影響しない", () => {
    expect(allowedRecordTypes(permissions, "cat-1")).toEqual(
      PERMISSION_RECORD_TYPES.filter(
        (type) => type !== "poop" && type !== "expense",
      ),
    );
    expect(allowedRecordTypes(permissions, "cat-3")).toEqual(
      PERMISSION_RECORD_TYPES,
    );
  });
});

describe("allowedWriteRecordTypes", () => {
  it("書き込みを許可していて、読み取りも許可している種類だけを返す", () => {
    expect(allowedWriteRecordTypes(permissions, "cat-1")).toEqual(["feeding"]);
    expect(allowedWriteRecordTypes(permissions, "cat-3")).toEqual([]);
  });
});

describe("isHouseholdOperationAllowed", () => {
  it("操作を許可していて、読み取りも許可している家だけで行える", () => {
    expect(
      isHouseholdOperationAllowed(permissions, "house-1", "foodProduct:read"),
    ).toBe(true);
    expect(
      isHouseholdOperationAllowed(permissions, "house-1", "foodProduct:create"),
    ).toBe(false);
    expect(
      isHouseholdOperationAllowed(permissions, "house-2", "foodProduct:read"),
    ).toBe(false);
  });
});

describe("isCatalogOperationAllowed", () => {
  it("操作を許可していて、ユーザーが admin のときだけ行える", () => {
    expect(
      isCatalogOperationAllowed(
        permissions,
        "admin",
        "catalogFoodProduct:read",
      ),
    ).toBe(true);
    expect(
      isCatalogOperationAllowed(
        permissions,
        "admin",
        "catalogFoodProduct:create",
      ),
    ).toBe(false);
    // 許可した後に admin でなくなったユーザーは行えない
    expect(
      isCatalogOperationAllowed(
        permissions,
        "member",
        "catalogFoodProduct:read",
      ),
    ).toBe(false);
  });
});

describe("buildPermissionTree", () => {
  it("家ごとに猫をまとめ、親のチェックが外れていれば子のチェックも外す", () => {
    const tree = buildPermissionTree(
      {
        excludedHouseholdIds: ["house-2"],
        excludedCatIds: ["cat-2"],
        // 外した家の猫の記録の種類は、親を外しているため使わない
        excludedRecordTypes: { "cat-1": ["poop"], "cat-3": ["water"] },
        // 読み取りを外した種類・猫・家の書き込みや操作は、チェックを外した状態にする
        writableRecordTypes: {
          "cat-1": ["feeding", "poop"],
          "cat-2": ["feeding"],
          "cat-3": ["feeding"],
        },
        householdOperations: {
          "house-1": ["feedingPreset:read"],
          "house-2": ["feedingPreset:read"],
        },
        catalogOperations: [],
      },
      [
        { id: "house-1", name: "家1" },
        { id: "house-2", name: "家2" },
      ],
      [
        {
          id: "cat-1",
          name: "たま",
          householdId: "house-1",
          memorialDate: null,
        },
        {
          id: "cat-2",
          name: "みけ",
          householdId: "house-1",
          memorialDate: null,
        },
        {
          id: "cat-3",
          name: "くろ",
          householdId: "house-2",
          memorialDate: null,
        },
      ],
    );

    expect(tree).toEqual([
      {
        id: "house-1",
        name: "家1",
        checked: true,
        operations: ["feedingPreset:read"],
        cats: [
          {
            id: "cat-1",
            name: "たま",
            memorial: false,
            checked: true,
            checkedRecordTypes: PERMISSION_RECORD_TYPES.filter(
              (type) => type !== "poop",
            ),
            writableRecordTypes: ["feeding"],
          },
          {
            id: "cat-2",
            name: "みけ",
            memorial: false,
            checked: false,
            checkedRecordTypes: [],
            writableRecordTypes: [],
          },
        ],
      },
      {
        id: "house-2",
        name: "家2",
        checked: false,
        operations: [],
        cats: [
          {
            id: "cat-3",
            name: "くろ",
            memorial: false,
            checked: false,
            checkedRecordTypes: [],
            writableRecordTypes: [],
          },
        ],
      },
    ]);
  });
});

describe("parsePermissionsInput", () => {
  const accessible = {
    householdIds: ["house-1", "house-2"],
    cats: [
      { id: "cat-1", householdId: "house-1", memorialDate: null },
      { id: "cat-2", householdId: "house-1", memorialDate: null },
      { id: "cat-3", householdId: "house-2", memorialDate: null },
    ],
    canUseCatalog: false,
  };

  it("所属する家・参照できる猫だけに絞り込み、外した家・猫の記録の種類は保存しない", () => {
    const value = JSON.stringify({
      excludedHouseholdIds: ["house-2", "house-2", "other-house"],
      excludedCatIds: ["cat-2", "cat-3", "other-cat"],
      excludedRecordTypes: {
        "cat-1": ["expense", "poop"],
        "cat-2": ["water"],
        "cat-3": ["water"],
        "other-cat": ["water"],
      },
    });

    const parsed = parsePermissionsInput(value, accessible);
    // 外した家の猫（cat-3）も、引っ越した後に読み取れないよう外したまま保存する
    expect(parsed).toEqual({
      excludedHouseholdIds: ["house-2"],
      excludedCatIds: ["cat-2", "cat-3"],
      excludedRecordTypes: { "cat-1": ["poop", "expense"] },
      writableRecordTypes: {},
      householdOperations: {},
      catalogOperations: [],
    });
    expect(
      parsed && isCatAllowed(parsed, { id: "cat-3", householdId: "house-1" }),
    ).toBe(false);
  });

  it("メモリーへ移した猫の書き込みの範囲は保存しない（読み取りの範囲は保存する）", () => {
    const value = JSON.stringify({
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: { "cat-1": ["poop"] },
      writableRecordTypes: { "cat-1": ["feeding"], "cat-2": ["feeding"] },
    });

    const parsed = parsePermissionsInput(value, {
      ...accessible,
      cats: accessible.cats.map((cat) =>
        cat.id === "cat-1" ? { ...cat, memorialDate: "2026-07-10" } : cat,
      ),
    });

    expect(parsed?.excludedRecordTypes).toEqual({ "cat-1": ["poop"] });
    expect(parsed?.writableRecordTypes).toEqual({ "cat-2": ["feeding"] });
  });

  it("空の配列・空の記録の種類は、何も外していない状態になる", () => {
    const value = JSON.stringify({
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: { "cat-1": [] },
    });

    expect(parsePermissionsInput(value, accessible)).toEqual(
      DEFAULT_PERMISSIONS,
    );
  });

  it("書き込み・家の操作は、読み取りを許可しているものだけを、決まった並び順で保存する", () => {
    const value = JSON.stringify({
      excludedHouseholdIds: ["house-2"],
      excludedCatIds: ["cat-2"],
      excludedRecordTypes: { "cat-1": ["water"] },
      writableRecordTypes: {
        // 読み取りを外した種類（water）は書き込めない
        "cat-1": ["poop", "water", "feeding"],
        // 外した猫・外した家の猫・参照できない猫は保存しない
        "cat-2": ["feeding"],
        "cat-3": ["feeding"],
        "other-cat": ["feeding"],
      },
      householdOperations: {
        "house-1": ["feedingPreset:delete", "foodProduct:read"],
        "house-2": ["foodProduct:read"],
        "other-house": ["foodProduct:read"],
      },
    });

    expect(parsePermissionsInput(value, accessible)).toMatchObject({
      writableRecordTypes: { "cat-1": ["feeding", "poop"] },
      householdOperations: {
        "house-1": ["foodProduct:read", "feedingPreset:delete"],
      },
    });
  });

  it("共通のごはん商品の操作は、admin のユーザーのときだけ決まった並び順で保存する", () => {
    const value = JSON.stringify({
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: {},
      catalogOperations: [
        "catalogFoodProduct:update",
        "catalogFoodProduct:read",
      ],
    });

    expect(
      parsePermissionsInput(value, { ...accessible, canUseCatalog: true }),
    ).toMatchObject({
      catalogOperations: [
        "catalogFoodProduct:read",
        "catalogFoodProduct:update",
      ],
    });
    expect(parsePermissionsInput(value, accessible)).toMatchObject({
      catalogOperations: [],
    });
  });

  it("値が無い・JSON でない・形が違う・知らない記録の種類を含む場合は null", () => {
    for (const value of [
      null,
      "",
      "{",
      JSON.stringify({ excludedHouseholdIds: [] }),
      JSON.stringify({
        excludedHouseholdIds: [],
        excludedCatIds: [],
        excludedRecordTypes: { "cat-1": ["birthday"] },
      }),
      JSON.stringify({
        excludedHouseholdIds: [],
        excludedCatIds: [],
        excludedRecordTypes: {},
        householdOperations: { "house-1": ["record:delete"] },
      }),
      JSON.stringify({
        excludedHouseholdIds: [],
        excludedCatIds: [],
        excludedRecordTypes: {},
        catalogOperations: ["catalogFoodProduct:delete"],
      }),
    ]) {
      expect(parsePermissionsInput(value, accessible)).toBeNull();
    }
  });
});
