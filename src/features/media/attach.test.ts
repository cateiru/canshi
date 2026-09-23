import { describe, expect, it } from "vitest";
import { planMediaSync } from "./attach";
import {
  MEDIA_ASSET_IDS_FIELD,
  MEDIA_FIELD_MARKER,
  parseMediaAssetIds,
} from "./formFields";

describe("parseMediaAssetIds", () => {
  it("添付欄の印がないフォームでは null を返す（添付を変更しない）", () => {
    const formData = new FormData();
    formData.append(MEDIA_ASSET_IDS_FIELD, "asset-1");
    expect(parseMediaAssetIds(formData)).toBeNull();
  });

  it("印があれば ID がなくても空配列を返す", () => {
    const formData = new FormData();
    formData.set(MEDIA_FIELD_MARKER, "1");
    expect(parseMediaAssetIds(formData)).toEqual([]);
  });

  it("順序を保ち、重複・不正な ID を除く", () => {
    const formData = new FormData();
    formData.set(MEDIA_FIELD_MARKER, "1");
    for (const id of ["b", "a", "b", "../x", ""]) {
      formData.append(MEDIA_ASSET_IDS_FIELD, id);
    }
    expect(parseMediaAssetIds(formData)).toEqual(["b", "a"]);
  });
});

describe("planMediaSync", () => {
  it("送られた順に既存・下書きの表示順を振り直し、外された既存を削除する", () => {
    expect(
      planMediaSync({
        submittedIds: ["draft-1", "asset-2"],
        currentIds: ["asset-1", "asset-2"],
        pendingIds: ["draft-1"],
      }),
    ).toEqual({
      assign: [
        { id: "draft-1", sortOrder: 0, isPending: true },
        { id: "asset-2", sortOrder: 1, isPending: false },
      ],
      remove: ["asset-1"],
      missing: [],
    });
  });

  it("他の記録の添付や見つからない ID は付け替えず missing にする", () => {
    expect(
      planMediaSync({
        submittedIds: ["other-record-asset", "draft-1"],
        currentIds: [],
        pendingIds: ["draft-1"],
      }),
    ).toEqual({
      assign: [{ id: "draft-1", sortOrder: 0, isPending: true }],
      remove: [],
      missing: ["other-record-asset"],
    });
  });

  it("空の一覧が送られたら既存の添付をすべて削除する", () => {
    expect(
      planMediaSync({
        submittedIds: [],
        currentIds: ["asset-1", "asset-2"],
        pendingIds: [],
      }),
    ).toEqual({ assign: [], remove: ["asset-1", "asset-2"], missing: [] });
  });
});
