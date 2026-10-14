import { describe, expect, it } from "vitest";
import { createJpeg } from "../test/jpeg";
import { parseCatalogFoodProductForm } from "./form";
import { checkCatalogImage, inspectJpeg } from "./image";

const VALID = {
  name: " まぐろ ",
  manufacturer: " ",
  kcalPer100g: "40.5",
  packageAmountG: "14",
  packageUnit: "1本",
  nutritionType: "general",
  textureType: "wet",
  targetBreed: "",
};

describe("parseCatalogFoodProductForm", () => {
  it("メインアプリのごはん商品と同じ規則で値を整える", () => {
    const parsed = parseCatalogFoodProductForm({
      ...VALID,
      lifeStages: ["care", "kitten"],
      image: new File([], ""),
      removeImage: "1",
    });
    expect(parsed).toEqual({
      ok: true,
      values: {
        name: "まぐろ",
        manufacturer: null,
        kcalPer100g: 40.5,
        packageAmountG: 14,
        // 先頭の「1」は取り除く
        packageUnit: "本",
        nutritionType: "general",
        textureType: "wet",
        lifeStages: ["kitten", "care"],
        targetBreed: null,
      },
      // ファイルを選ばずに送られた空のファイルは、画像なしとして扱う
      image: null,
      removeImage: true,
    });
  });

  it("対象の猫が 1 つだけでも配列として受け取る", () => {
    const parsed = parseCatalogFoodProductForm({
      ...VALID,
      lifeStages: "adult",
    });
    expect(parsed.ok && parsed.values.lifeStages).toEqual(["adult"]);
  });

  it("誤りのある項目ごとにエラーを返す", () => {
    const parsed = parseCatalogFoodProductForm({
      ...VALID,
      name: "",
      kcalPer100g: "abc",
      packageAmountG: "-1",
      nutritionType: "unknown",
      textureType: "",
      lifeStages: ["puppy"],
      packageUnit: "とても長い単位の名前です",
    });
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && Object.keys(parsed.errors).sort()).toEqual(
      [
        "kcalPer100g",
        "lifeStages",
        "name",
        "nutritionType",
        "packageAmountG",
        "packageUnit",
        "textureType",
      ].sort(),
    );
  });
});

describe("inspectJpeg", () => {
  it("JPEG の寸法と、メタデータのセグメントの有無を読み取る", () => {
    expect(inspectJpeg(createJpeg(800, 533))).toEqual({
      width: 800,
      height: 533,
      hasMetadata: false,
    });
    expect(inspectJpeg(createJpeg(10, 20, { exif: true }))).toEqual({
      width: 10,
      height: 20,
      hasMetadata: true,
    });
  });

  it("JPEG でない・途中で切れているときは null", () => {
    expect(
      inspectJpeg(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBeNull();
    expect(inspectJpeg(createJpeg(800, 533).slice(0, 30))).toBeNull();
  });
});

describe("checkCatalogImage", () => {
  const file = (bytes: Uint8Array) => new File([bytes], "photo.jpg");

  it("ブラウザで縮小した形（長辺 800px 以下・メタデータなしの JPEG）だけを受け付ける", async () => {
    expect(await checkCatalogImage(file(createJpeg(800, 533)))).toMatchObject({
      ok: true,
      mimeType: "image/jpeg",
    });
  });

  it("縮小されずに届いた画像は断る", async () => {
    const rejected = [
      // 長辺が 800px を超える
      createJpeg(801, 600),
      // 位置情報などを含みうる Exif を持つ
      createJpeg(400, 300, { exif: true }),
      // JPEG ではない（スクリプトが動かず PNG のまま届いた）
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ];
    for (const bytes of rejected) {
      expect(await checkCatalogImage(file(bytes))).toMatchObject({ ok: false });
    }
  });
});
