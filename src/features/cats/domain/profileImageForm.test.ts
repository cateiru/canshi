import { describe, expect, it } from "vitest";
import {
  PROFILE_IMAGE_ACTION_FIELD,
  PROFILE_IMAGE_ASSET_ID_FIELD,
  parseProfileImageChange,
} from "./profileImageForm";

function formDataOf(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }
  return formData;
}

describe("parseProfileImageChange", () => {
  it("フィールドがなければ変更しない", () => {
    expect(parseProfileImageChange(new FormData())).toEqual({ type: "keep" });
  });

  it("set では asset ID を取り出す", () => {
    expect(
      parseProfileImageChange(
        formDataOf({
          [PROFILE_IMAGE_ACTION_FIELD]: "set",
          [PROFILE_IMAGE_ASSET_ID_FIELD]: "asset-1",
        }),
      ),
    ).toEqual({ type: "set", assetId: "asset-1" });
  });

  it("set でも asset ID がない・不正なら変更しない", () => {
    expect(
      parseProfileImageChange(
        formDataOf({ [PROFILE_IMAGE_ACTION_FIELD]: "set" }),
      ),
    ).toEqual({ type: "keep" });
    expect(
      parseProfileImageChange(
        formDataOf({
          [PROFILE_IMAGE_ACTION_FIELD]: "set",
          [PROFILE_IMAGE_ASSET_ID_FIELD]: "../asset",
        }),
      ),
    ).toEqual({ type: "keep" });
  });

  it("remove を受け付ける", () => {
    expect(
      parseProfileImageChange(
        formDataOf({ [PROFILE_IMAGE_ACTION_FIELD]: "remove" }),
      ),
    ).toEqual({ type: "remove" });
  });

  it("不明な値は変更しない", () => {
    expect(
      parseProfileImageChange(
        formDataOf({ [PROFILE_IMAGE_ACTION_FIELD]: "unknown" }),
      ),
    ).toEqual({ type: "keep" });
  });
});
