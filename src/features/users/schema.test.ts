import { describe, expect, it } from "vitest";
import { userProfileFormSchema } from "./schema";

describe("userProfileFormSchema", () => {
  it("前後の空白を除いた名前を受け付ける", () => {
    expect(userProfileFormSchema.parse({ name: "  ねこ好き  " })).toEqual({
      name: "ねこ好き",
    });
  });

  it("空の名前・空白だけの名前・未送信はエラーにする", () => {
    for (const name of ["", "   ", null]) {
      const result = userProfileFormSchema.safeParse({ name });
      expect(result.success).toBe(false);
      expect(result.error?.flatten().fieldErrors.name).toEqual([
        "名前を入力してください",
      ]);
    }
  });

  it("50 文字を超える名前はエラーにする", () => {
    expect(
      userProfileFormSchema.safeParse({ name: "あ".repeat(50) }).success,
    ).toBe(true);
    expect(
      userProfileFormSchema
        .safeParse({ name: "あ".repeat(51) })
        .error?.flatten().fieldErrors.name,
    ).toEqual(["名前は50文字以内で入力してください"]);
  });
});
