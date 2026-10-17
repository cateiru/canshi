// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  isTimelineAnniversaryType,
  TIMELINE_RECORD_TYPES,
} from "@/features/timeline/queries";
import {
  allowedMcpRecordTypes,
  buildMcpPermissionTree,
  DEFAULT_MCP_PERMISSIONS,
  isCatAllowedForMcp,
  MCP_ALWAYS_ALLOWED_TIMELINE_TYPES,
  MCP_PERMISSION_RECORD_TYPES,
  type McpPermissions,
  parseMcpPermissionsInput,
} from "./permissionRules";

const permissions: McpPermissions = {
  excludedHouseholdIds: ["house-2"],
  excludedCatIds: ["cat-2"],
  excludedRecordTypes: { "cat-1": ["poop", "expense"] },
};

describe("MCP_PERMISSION_RECORD_TYPES", () => {
  it("タイムラインの記録の種類のうち、記念日以外をすべて含む", () => {
    expect(MCP_PERMISSION_RECORD_TYPES).toEqual(
      TIMELINE_RECORD_TYPES.filter((type) => !isTimelineAnniversaryType(type)),
    );
    expect(MCP_ALWAYS_ALLOWED_TIMELINE_TYPES).toEqual(
      TIMELINE_RECORD_TYPES.filter(isTimelineAnniversaryType),
    );
  });
});

describe("isCatAllowedForMcp", () => {
  it("外した家の猫・外した猫・家の無い猫は読み取れない", () => {
    expect(
      isCatAllowedForMcp(permissions, { id: "cat-1", householdId: "house-1" }),
    ).toBe(true);
    expect(
      isCatAllowedForMcp(permissions, { id: "cat-3", householdId: "house-2" }),
    ).toBe(false);
    expect(
      isCatAllowedForMcp(permissions, { id: "cat-2", householdId: "house-1" }),
    ).toBe(false);
    expect(
      isCatAllowedForMcp(DEFAULT_MCP_PERMISSIONS, {
        id: "cat-1",
        householdId: null,
      }),
    ).toBe(false);
  });
});

describe("allowedMcpRecordTypes", () => {
  it("外した記録の種類を除き、ほかの猫には影響しない", () => {
    expect(allowedMcpRecordTypes(permissions, "cat-1")).toEqual(
      MCP_PERMISSION_RECORD_TYPES.filter(
        (type) => type !== "poop" && type !== "expense",
      ),
    );
    expect(allowedMcpRecordTypes(permissions, "cat-3")).toEqual(
      MCP_PERMISSION_RECORD_TYPES,
    );
  });
});

describe("buildMcpPermissionTree", () => {
  it("家ごとに猫をまとめ、親のチェックが外れていれば子のチェックも外す", () => {
    const tree = buildMcpPermissionTree(
      {
        excludedHouseholdIds: ["house-2"],
        excludedCatIds: ["cat-2"],
        // 外した家の猫の記録の種類は、親を外しているため使わない
        excludedRecordTypes: { "cat-1": ["poop"], "cat-3": ["water"] },
      },
      [
        { id: "house-1", name: "家1" },
        { id: "house-2", name: "家2" },
      ],
      [
        { id: "cat-1", name: "たま", householdId: "house-1" },
        { id: "cat-2", name: "みけ", householdId: "house-1" },
        { id: "cat-3", name: "くろ", householdId: "house-2" },
      ],
    );

    expect(tree).toEqual([
      {
        id: "house-1",
        name: "家1",
        checked: true,
        cats: [
          {
            id: "cat-1",
            name: "たま",
            checked: true,
            checkedRecordTypes: MCP_PERMISSION_RECORD_TYPES.filter(
              (type) => type !== "poop",
            ),
          },
          { id: "cat-2", name: "みけ", checked: false, checkedRecordTypes: [] },
        ],
      },
      {
        id: "house-2",
        name: "家2",
        checked: false,
        cats: [
          { id: "cat-3", name: "くろ", checked: false, checkedRecordTypes: [] },
        ],
      },
    ]);
  });
});

describe("parseMcpPermissionsInput", () => {
  const accessible = {
    householdIds: ["house-1", "house-2"],
    cats: [
      { id: "cat-1", householdId: "house-1" },
      { id: "cat-2", householdId: "house-1" },
      { id: "cat-3", householdId: "house-2" },
    ],
  };

  it("所属する家・参照できる猫だけに絞り込み、親を外した子は保存しない", () => {
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

    expect(parseMcpPermissionsInput(value, accessible)).toEqual({
      excludedHouseholdIds: ["house-2"],
      excludedCatIds: ["cat-2"],
      excludedRecordTypes: { "cat-1": ["poop", "expense"] },
    });
  });

  it("空の配列・空の記録の種類は、何も外していない状態になる", () => {
    const value = JSON.stringify({
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: { "cat-1": [] },
    });

    expect(parseMcpPermissionsInput(value, accessible)).toEqual(
      DEFAULT_MCP_PERMISSIONS,
    );
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
    ]) {
      expect(parseMcpPermissionsInput(value, accessible)).toBeNull();
    }
  });
});
