import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createMigratedDatabase, toAdminDb } from "./test/d1";
import { seed } from "./test/fixtures";
import { createJpeg } from "./test/jpeg";
import { createFakeBucket } from "./test/r2";

let env: Env;
let bucket: ReturnType<typeof createFakeBucket>;

beforeEach(async () => {
  const database = await createMigratedDatabase();
  seed(database);
  bucket = createFakeBucket();
  env = {
    DB: toAdminDb(database) as D1Database,
    MEDIA_BUCKET: bucket.bucket,
  };
});

const ORIGIN = "https://canshi-admin.cateiru.dev";

function request(path: string, init: RequestInit = {}) {
  return createApp().request(`${ORIGIN}${path}`, init, env);
}

/** 管理画面のフォームからの送信（ブラウザは Origin を付ける） */
function postForm(path: string, origin = ORIGIN, body = "") {
  return request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
    },
    body,
  });
}

async function countSessions(userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?1",
  )
    .bind(userId)
    .all<{ count: number }>();
  return results[0].count;
}

describe("画面", () => {
  it("概要に件数と、家に未所属の猫の警告を表示する", async () => {
    const response = await request("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain("家に所属していない猫が 1");
    // `household:link` は --local・--remote のどちらかが無いと実行できない
    expect(html).toContain("pnpm household:link --remote");
  });

  it("ライトテーマに固定して表示する", async () => {
    const html = await (await request("/")).text();
    expect(html).toContain('<meta name="color-scheme" content="light"/>');
    expect(html).toContain("color-scheme: light;");
    expect(html).not.toContain("prefers-color-scheme");
  });

  it("ユーザー一覧で、利用者の入力した名前をエスケープして表示する", async () => {
    const response = await request("/users");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("たろう");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    // セッションのトークン（ハッシュ）は表示しない
    expect(html).not.toContain("hash-active-1");
  });

  it("家の一覧に、メンバーと猫の数を表示する", async () => {
    const response = await request("/households");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("わが家");
    expect(html).toContain("たろう（オーナー）");
  });
});

describe("すべての端末からログアウトさせる", () => {
  beforeEach(async () => {
    // 画面は実行時の日時で有効なセッションを数えるため、テスト用データ（2026-10-01 基準）の
    // セッションとは別に、期限が十分先のセッションを user-1 に作る
    const expiresAt = Math.floor(Date.now() / 1000) + 86_400;
    await env.DB.prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('hash-current', 'user-1', ?1)",
    )
      .bind(expiresAt)
      .run();
  });

  it("有効なセッションがあるユーザーにだけボタンを表示する", async () => {
    const html = await (await request("/users")).text();
    expect(html).toContain('action="/users/user-1/sessions/delete"');
    // 期限切れのセッションしかないユーザー・セッションが無いユーザー
    expect(html).not.toContain('action="/users/user-2/sessions/delete"');
    expect(html).not.toContain('action="/users/user-3/sessions/delete"');
  });

  it("ユーザーのセッションをすべて削除し、結果をユーザー一覧に表示する", async () => {
    const response = await postForm("/users/user-1/sessions/delete");
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/users?loggedOut=user-1");
    expect(await countSessions("user-1")).toBe(0);
    // ほかのユーザーのセッションは残る
    expect(await countSessions("user-3")).toBe(1);

    const html = await (
      await request(response.headers.get("Location") ?? "")
    ).text();
    expect(html).toContain("たろう をすべての端末からログアウトさせました。");
  });

  it("ほかのオリジンからの送信は拒否し、セッションを削除しない", async () => {
    const response = await postForm(
      "/users/user-1/sessions/delete",
      "https://evil.example.com",
    );
    expect(response.status).toBe(403);
    expect(await countSessions("user-1")).toBe(4);
  });
});

async function householdRoles(householdId: string) {
  const { results } = await env.DB.prepare(
    "SELECT user_id, role FROM household_members WHERE household_id = ?1 ORDER BY user_id",
  )
    .bind(householdId)
    .all<{ user_id: string; role: string }>();
  return results.map((row) => `${row.user_id}:${row.role}`);
}

describe("家のメンバーの追加・削除", () => {
  it("まだメンバーでないユーザーだけを追加の候補にし、オーナー以外にだけ外すボタンを表示する", async () => {
    const html = await (await request("/households")).text();
    expect(html).toContain('action="/households/household-2/members"');
    // household-1 には user-3 だけが候補になる
    const household1Form = html.slice(
      html.indexOf('action="/households/household-1/members"'),
    );
    const select = household1Form.slice(0, household1Form.indexOf("</select>"));
    expect(select).toContain('value="user-3"');
    expect(select).not.toContain('value="user-1"');
    expect(select).not.toContain('value="user-2"');

    expect(html).toContain(
      'action="/households/household-1/members/user-2/delete"',
    );
    expect(html).not.toContain(
      'action="/households/household-1/members/user-1/delete"',
    );
  });

  it("ユーザーをメンバーとして追加し、結果を家の一覧に表示する", async () => {
    const response = await postForm(
      "/households/household-2/members",
      ORIGIN,
      "userId=user-3",
    );
    expect(response.status).toBe(303);
    const location = response.headers.get("Location") ?? "";
    expect(location).toBe(
      "/households?memberChange=added&household=household-2&user=user-3",
    );
    expect(await householdRoles("household-2")).toEqual([
      "user-1:owner",
      "user-3:member",
    ]);

    const html = await (await request(location)).text();
    expect(html).toContain("はなこ を 実家 のメンバーに追加しました。");
  });

  it("すでにメンバーのユーザーは追加せず、失敗を表示する", async () => {
    const response = await postForm(
      "/households/household-1/members",
      ORIGIN,
      "userId=user-1",
    );
    const location = response.headers.get("Location") ?? "";
    expect(location).toContain("memberChange=add-failed");
    expect(await householdRoles("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
    const html = await (await request(location)).text();
    expect(html).toContain("のメンバーに追加できませんでした");
  });

  it("オーナー以外のメンバーを家から外し、結果を表示する", async () => {
    const response = await postForm(
      "/households/household-1/members/user-2/delete",
    );
    expect(response.status).toBe(303);
    const location = response.headers.get("Location") ?? "";
    expect(await householdRoles("household-1")).toEqual(["user-1:owner"]);
    const html = await (await request(location)).text();
    // ユーザー名はエスケープして表示する
    expect(html).toContain(
      "&lt;script&gt;alert(1)&lt;/script&gt; を わが家 から外しました。",
    );
  });

  it("オーナーは外さず、失敗を表示する", async () => {
    const response = await postForm(
      "/households/household-1/members/user-1/delete",
    );
    const location = response.headers.get("Location") ?? "";
    expect(location).toContain("memberChange=remove-failed");
    expect(await householdRoles("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
    const html = await (await request(location)).text();
    expect(html).toContain("オーナーは外せないため");
  });

  it("ほかのオリジンからの送信は拒否し、メンバーを変えない", async () => {
    const added = await postForm(
      "/households/household-2/members",
      "https://evil.example.com",
      "userId=user-3",
    );
    expect(added.status).toBe(403);
    const removed = await postForm(
      "/households/household-1/members/user-2/delete",
      "https://evil.example.com",
    );
    expect(removed.status).toBe(403);
    expect(await householdRoles("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
    expect(await householdRoles("household-2")).toEqual(["user-1:owner"]);
  });
});

describe("共通のごはん商品", () => {
  // ブラウザで縮小した形の JPEG（長辺 800px 以下・メタデータなし）
  const JPEG_BYTES = createJpeg(800, 533);

  function productForm(values: Record<string, string | string[]> = {}) {
    const form = new FormData();
    const fields: Record<string, string | string[]> = {
      name: "まぐろ味 カリカリ",
      manufacturer: "ねこフード",
      kcalPer100g: "380",
      packageAmountG: "500",
      packageUnit: "",
      nutritionType: "complete",
      textureType: "dry",
      lifeStages: ["senior", "adult"],
      targetBreed: "",
      ...values,
    };
    for (const [key, value] of Object.entries(fields)) {
      for (const item of Array.isArray(value) ? value : [value]) {
        form.append(key, item);
      }
    }
    return form;
  }

  function postMultipart(path: string, body: FormData, origin = ORIGIN) {
    return request(path, { method: "POST", headers: { Origin: origin }, body });
  }

  async function listProducts() {
    const { results } = await env.DB.prepare(
      "SELECT * FROM catalog_food_products ORDER BY name",
    ).all<Record<string, unknown>>();
    return results;
  }

  async function listImages() {
    const { results } = await env.DB.prepare(
      "SELECT * FROM media_assets WHERE record_type = 'catalog_food_product'",
    ).all<Record<string, unknown>>();
    return results;
  }

  /** 画像付きで登録し、商品の ID を返す */
  async function createWithImage() {
    const form = productForm();
    form.append("image", new File([JPEG_BYTES], "photo.jpg"));
    const response = await postMultipart("/food-products", form);
    expect(response.status).toBe(303);
    return new URL(
      response.headers.get("Location") ?? "",
      ORIGIN,
    ).searchParams.get("product") as string;
  }

  it("ナビゲーションから一覧を開ける", async () => {
    const html = await (await request("/food-products")).text();
    expect(html).toContain('href="/food-products" aria-current="page"');
    expect(html).toContain("共通のごはん商品はまだありません。");
  });

  it("画像付きで登録し、結果を一覧に表示する", async () => {
    const id = await createWithImage();

    expect(await listProducts()).toEqual([
      expect.objectContaining({
        id,
        name: "まぐろ味 カリカリ",
        manufacturer: "ねこフード",
        kcal_per_100g: 380,
        package_amount_g: 500,
        package_unit: null,
        nutrition_type: "complete",
        texture_type: "dry",
        // 選んだ順ではなく決まった順で保存する
        life_stages: '["adult","senior"]',
        target_breed: null,
      }),
    ]);
    const [image] = await listImages();
    expect(image).toMatchObject({
      record_id: id,
      cat_id: null,
      uploaded_by_user_id: null,
      thumbnail_object_key: null,
      mime_type: "image/jpeg",
      size_bytes: JPEG_BYTES.length,
    });
    expect(image.object_key).toBe(`catalog_food_product/${id}/${image.id}`);
    expect(bucket.objects.get(image.object_key as string)?.body).toEqual(
      JPEG_BYTES,
    );

    const html = await (
      await request(`/food-products?catalogChange=created&product=${id}`)
    ).text();
    expect(html).toContain("まぐろ味 カリカリ を登録しました。");
    expect(html).toContain("成猫・シニア");
    expect(html).toContain(`/food-products/${id}/image`);

    const imageResponse = await request(`/food-products/${id}/image`);
    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers.get("Content-Type")).toBe("image/jpeg");
    expect(new Uint8Array(await imageResponse.arrayBuffer())).toEqual(
      JPEG_BYTES,
    );
  });

  it("入力に誤りがあるときは登録せず、入力値とエラーを表示し直す", async () => {
    const response = await postMultipart(
      "/food-products",
      productForm({
        name: " ",
        kcalPer100g: "0",
        manufacturer: "<b>メーカー</b>",
      }),
    );
    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain("商品名を入力してください");
    expect(html).toContain(
      "カロリー（kcal/100g）は0より大きい値を入力してください",
    );
    // 入力値はエスケープして表示し直す
    expect(html).toContain("&lt;b&gt;メーカー&lt;/b&gt;");
    expect(await listProducts()).toEqual([]);
  });

  it("ブラウザで縮小されずに届いた画像・画像ではないファイルは登録せず、R2 にも置かない", async () => {
    const files = [
      // スクリプトが動かず、位置情報などの Exif を持ったまま届いた写真
      new File([createJpeg(4000, 3000, { exif: true })], "photo.jpg"),
      new File(["not an image"], "note.txt"),
    ];
    for (const file of files) {
      const form = productForm();
      form.append("image", file);
      const response = await postMultipart("/food-products", form);
      expect(response.status).toBe(400);
      expect(await response.text()).toContain(
        "画像をブラウザで縮小できませんでした",
      );
    }
    expect(await listProducts()).toEqual([]);
    expect(bucket.objects.size).toBe(0);
  });

  it("編集で内容と画像を差し替え、古い画像を R2 から削除する", async () => {
    const id = await createWithImage();
    const [oldImage] = await listImages();

    const editHtml = await (await request(`/food-products/${id}/edit`)).text();
    expect(editHtml).toContain('value="まぐろ味 カリカリ"');
    expect(editHtml).toContain("今の画像を削除する");

    const form = productForm({ name: "かつお味 カリカリ", textureType: "wet" });
    const replacement = createJpeg(600, 800);
    form.append("image", new File([replacement], "photo2.jpg"));
    const response = await postMultipart(`/food-products/${id}`, form);
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      `/food-products?catalogChange=updated&product=${id}`,
    );

    expect(await listProducts()).toEqual([
      expect.objectContaining({
        name: "かつお味 カリカリ",
        texture_type: "wet",
      }),
    ]);
    const [newImage] = await listImages();
    expect(newImage).toMatchObject({
      mime_type: "image/jpeg",
      size_bytes: replacement.length,
    });
    expect(newImage.id).not.toBe(oldImage.id);
    expect(bucket.objects.has(oldImage.object_key as string)).toBe(false);
    expect(bucket.objects.has(newImage.object_key as string)).toBe(true);
  });

  it("編集で画像の削除を選ぶと、画像を削除する", async () => {
    const id = await createWithImage();
    const response = await postMultipart(
      `/food-products/${id}`,
      productForm({ removeImage: "1" }),
    );
    expect(response.status).toBe(303);
    expect(await listImages()).toEqual([]);
    expect(bucket.objects.size).toBe(0);
  });

  it("削除しても家に追加済みの商品は残し、追加元だけを外す", async () => {
    const id = await createWithImage();
    await env.DB.prepare(
      `INSERT INTO food_products
        (id, household_id, name, kcal_per_100g, package_amount_g, nutrition_type,
         texture_type, catalog_food_product_id)
      VALUES ('food-1', 'household-1', 'まぐろ味 カリカリ', 380, 500, 'complete', 'dry', ?1)`,
    )
      .bind(id)
      .run();
    expect(await (await request("/food-products")).text()).toMatch(
      /<td class="num">1<\/td>/,
    );

    const response = await postForm(`/food-products/${id}/delete`);
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "/food-products?catalogChange=deleted",
    );
    expect(await listProducts()).toEqual([]);
    expect(await listImages()).toEqual([]);
    expect(bucket.objects.size).toBe(0);
    const { results } = await env.DB.prepare(
      "SELECT catalog_food_product_id FROM food_products WHERE id = 'food-1'",
    ).all<{ catalog_food_product_id: string | null }>();
    expect(results).toEqual([{ catalog_food_product_id: null }]);
  });

  it("R2 から画像を削除できなかったときは、商品と画像の行を残す", async () => {
    const id = await createWithImage();
    bucket.state.failDelete = true;
    const response = await postForm(`/food-products/${id}/delete`);
    expect(response.status).toBe(500);
    expect(await listProducts()).toHaveLength(1);
    expect(await listImages()).toHaveLength(1);
  });

  it("存在しない商品は 404 にする", async () => {
    expect((await request("/food-products/missing/edit")).status).toBe(404);
    expect((await request("/food-products/missing/image")).status).toBe(404);
    expect(
      (await postMultipart("/food-products/missing", productForm())).status,
    ).toBe(404);
    expect((await postForm("/food-products/missing/delete")).status).toBe(404);
  });

  it("ほかのオリジンからの送信は拒否し、登録しない", async () => {
    const response = await postMultipart(
      "/food-products",
      productForm(),
      "https://evil.example",
    );
    expect(response.status).toBe(403);
    expect(await listProducts()).toEqual([]);
  });
});
