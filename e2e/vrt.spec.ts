import { createPng } from "../src/features/media/testing/createPng";
import { fillAndKeep } from "./helpers";
import { expect, takeSnapshot, test } from "./vrt-snapshot";

// ビジュアルリグレッションテスト (reg-suit)。
//
// 猫データに依存するページは、実行日時に依存しない固定フィクスチャ
// (e2e/fixtures/vrt-seed.sql) を使って対象にする。ローカルで実行する場合は
// `pnpm db:migrate:local && pnpm vrt:seed` を先に実行してフィクスチャを
// 投入しておくこと（CI の vrt ジョブでは自動的に実行される）。
//
// - EMPTY_CAT: どの記録も登録していない猫。各記録一覧の「何もないケース」用
// - CAT: 各記録種別を1件ずつ登録した猫。「データがあるケース」用。
//   掃除記録の対象・服薬予定はそれぞれ2件登録し、1件だけ実績なしにすることで、
//   ネストした一覧ページの「データがある/何もない」の両方をこの1匹で再現する
// - BUSY_CAT: 同じ日に5種類の記録を登録した猫。タイムラインのカレンダーで1日のアイコンが
//   表示上限を超えて「+1」になるケース用
// - APPROXIMATE_CAT: あいまいモードのごはん記録だけを登録した猫。ごはん記録一覧・
//   タイムラインのあいまいモード表示用
//
// 以下は対象外 (意図的な除外):
// - "/" : 登録済みの猫の数によってリダイレクト先が変わる (top-page.spec.ts 参照)
// - "/notifications" : 表示するたびに `generateNotifications` で通知を生成する副作用があり、
//   登録済みの猫のデータにも依存する
// - "/dev/media" : `recordId` の初期値が `crypto.randomUUID()` で、フォームに
//   そのまま表示されるため実行するたびにスナップショットが変わってしまう
// - 猫ごとの記録の「編集」ページ (weight-records/[id]/edit 等): 今回のスコープでは
//   猫自体の編集ページのみを対象にし、記録単位の編集ページは対象外にした
// - 通院記録・掃除記録の「データがあるケース」に表示されるカレンダーグラフは
//   直近365日のヒートマップで実行日時に依存するため、その部分だけ ignoreSelectors
//   で除外している（ページ自体は対象にする）

const EMPTY_CAT = "vrt-cat-empty";
const CAT = "vrt-cat-populated";
const BUSY_CAT = "vrt-cat-busy";
const APPROXIMATE_CAT = "vrt-cat-approximate";
const YM = "2024-06";

// CAT の誕生日（フィクスチャの生年月日 2015-04-01 と同じ 4/1）に実行すると、猫一覧・猫の詳細で
// お祝いのモーダル（BirthdayCelebration）が開き、スクリーンショットに写り込んだり
// 以降の操作を遮ったりする。この端末ではお祝い済みとして localStorage に記録しておき、
// 実行日に関わらずモーダルが開かないようにする（キーは `birthdayCelebratedStorageKey` と同じ形式）
test.beforeEach(async ({ page }) => {
  await page.addInitScript((catId) => {
    const years = new Date().getFullYear() - 2015;
    try {
      window.localStorage.setItem(
        `canshi:birthday-celebrated:${catId}:yearly:${years}`,
        "vrt",
      );
    } catch {
      // localStorage が使えないページ（about:blank など）では何もしない
    }
  }, CAT);
});

test("コンポーネントプレビューページの見た目", async ({ page }, testInfo) => {
  await page.goto("/dev/components");
  await expect(
    page.getByRole("heading", { name: "コンポーネントプレビュー" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("オフラインページの見た目", async ({ page }, testInfo) => {
  await page.goto("/offline");
  await expect(
    page.getByRole("heading", { name: "オフラインです" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("ホームページの見た目", async ({ page }, testInfo) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "CANSHI" })).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("猫一覧ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/cats");
  await expect(page.getByRole("heading", { name: "猫一覧" })).toBeVisible();

  // 固定フィクスチャの年齢とお迎えからの期間は撮影日で変わる。
  // 既存のベースラインを撮影した 2026-09-22 の表示に揃える。
  const catDetails = page
    .getByRole("heading", { name: "VRTテスト猫", exact: true })
    .locator("..");
  const age = catDetails.getByText(/^\d+歳(?:\d+ヶ月)?$/);
  const timeSinceAdoption = catDetails.getByText(
    /^お迎えから\d+年(?:\d+ヶ月)?$/,
  );
  await expect(age).toBeVisible();
  await expect(timeSinceAdoption).toBeVisible();
  await age.evaluate((element) => {
    element.textContent = "11歳5ヶ月";
  });
  await timeSinceAdoption.evaluate((element) => {
    element.textContent = "お迎えから11年3ヶ月";
  });

  await takeSnapshot(page, testInfo);
});

test("猫登録ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/cats/new");
  await expect(
    page.getByRole("heading", { name: "猫を登録する" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("ごはん商品一覧ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/food-products");
  await expect(
    page.getByRole("heading", { name: "ごはん商品一覧" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("ごはん商品登録ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/food-products/new");
  await expect(
    page.getByRole("heading", { name: "ごはん商品を登録する" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("ごはんプリセット一覧ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/feeding-presets");
  await expect(
    page.getByRole("heading", { name: "ごはんプリセット一覧" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// フィクスチャ投入後は food_products が1件存在するため、このページは
// 「先に商品を登録してください」の分岐ではなく、実際の登録フォームの分岐を表示する
test("ごはんプリセット登録ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/feeding-presets/new");
  await expect(
    page.getByRole("heading", { name: "ごはんプリセットを登録する" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// 記録方法を「あいまいモード」に切り替え、与える量が段階の選択肢になった状態を撮る。
// 保存はしないため、フィクスチャのデータは変わらない
test("ごはんプリセット登録ページ（あいまいモード）の見た目", async ({
  page,
}, testInfo) => {
  await page.goto("/feeding-presets/new");
  await expect(
    page.getByRole("heading", { name: "ごはんプリセットを登録する" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "あいまいモード" }).click();
  await expect(
    page.getByRole("radiogroup", { name: "与える量" }).first(),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("記録方法のヘルプページの見た目", async ({ page }, testInfo) => {
  await page.goto("/help/feeding-modes");
  await expect(
    page.getByRole("heading", {
      name: "「厳格モード」「あいまいモード」とは？",
    }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("設定ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "設定", exact: true }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("通知設定ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/settings/notifications");
  // 「猫ごとの通知設定」の見出しにも部分一致してしまうため、完全一致で探す
  await expect(
    page.getByRole("heading", { name: "通知設定", exact: true }),
  ).toBeVisible();
  // PushSubscriptionToggle はクライアント側で実行環境を判定するまで何も描画しない。
  // 判定前に fullPage の高さが計測されると、その直後に案内が表示されてフッターの
  // 位置だけがずれたスクリーンショットになるため、VRT 環境の確定表示を待つ。
  const pushSettings = page
    .getByRole("heading", { name: "この端末での通知" })
    .locator("..");
  await expect(pushSettings.getByRole("alert")).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("見た目設定ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/settings/appearance");
  await expect(
    page.getByRole("heading", { name: "見た目設定", exact: true }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// ダークテーマ・コントラストを上げた状態は、色の差し替えが広く効くページで代表して確認する
for (const { label, theme, contrast } of [
  { label: "ダーク", theme: "dark", contrast: "default" },
  { label: "ダーク・コントラスト上げ", theme: "dark", contrast: "more" },
  { label: "ライト・コントラスト上げ", theme: "light", contrast: "more" },
]) {
  test.describe(`${label}の見た目`, () => {
    test.beforeEach(async ({ page, baseURL }) => {
      await page.context().addCookies([
        { name: "canshi-theme", value: theme, url: baseURL },
        { name: "canshi-contrast", value: contrast, url: baseURL },
      ]);
    });

    test(`見た目設定ページ（${label}）`, async ({ page }, testInfo) => {
      await page.goto("/settings/appearance");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await takeSnapshot(page, testInfo);
    });

    // 猫の年齢・お迎えからの期間は実行日時から計算されるため、その部分だけ除外する
    test.describe(() => {
      test.use({ ignoreSelectors: ['[class*="details"] dd'] });

      test(`猫の詳細ページ（${label}）`, async ({ page }, testInfo) => {
        await page.goto(`/cats/${CAT}`);
        await expect(
          page.getByRole("heading", { name: "VRTテスト猫", exact: true }),
        ).toBeVisible();
        await takeSnapshot(page, testInfo);
      });
    });

    test(`タイムラインのカレンダー（${label}）`, async ({ page }, testInfo) => {
      await page.goto(`/cats/${BUSY_CAT}/timeline?ym=${YM}`);
      await expect(page.getByText("+1", { exact: true })).toBeVisible();
      await takeSnapshot(page, testInfo);
    });

    test(`コンポーネントプレビュー（${label}）`, async ({ page }, testInfo) => {
      await page.goto("/dev/components");
      await expect(
        page.getByRole("heading", { name: "コンポーネントプレビュー" }),
      ).toBeVisible();
      await takeSnapshot(page, testInfo);
    });
  });
}

test("更新情報ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/release-notes");
  await expect(page.getByRole("heading", { name: "更新情報" })).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// 猫の年齢・お迎えからの期間は実行日時から計算されるため、その部分だけ除外する
test.describe("猫の詳細ページ（データがある）", () => {
  test.use({ ignoreSelectors: ['[class*="details"] dd'] });

  test("猫の詳細ページ（データがある）の見た目", async ({ page }, testInfo) => {
    await page.goto(`/cats/${CAT}`);
    await expect(
      page.getByRole("heading", { name: "VRTテスト猫", exact: true }),
    ).toBeVisible();
    await takeSnapshot(page, testInfo);
  });
});

test("猫の編集ページ（データがある）の見た目", async ({ page }, testInfo) => {
  await page.goto(`/cats/${CAT}/edit`);
  await expect(
    page.getByRole("heading", { name: "VRTテスト猫を編集する" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("プロフィール画像の切り抜きモーダルの見た目", async ({
  page,
}, testInfo) => {
  await page.goto(`/cats/${CAT}/edit`);
  await expect(
    page.getByRole("heading", { name: "VRTテスト猫を編集する" }),
  ).toBeVisible();

  // 切り抜き枠との位置関係がわかるよう、左右で色を変えた横長の画像を選ぶ。
  // 切り抜きモーダルを開くだけでアップロードはしないため、フィクスチャのデータは変わらない
  const image = createPng(320, 240, (x) =>
    x < 160 ? [220, 80, 60, 255] : [60, 120, 220, 255],
  );
  await page.getByLabel("プロフィール画像のファイル").setInputFiles({
    name: "vrt-profile.png",
    mimeType: "image/png",
    buffer: Buffer.from(image),
  });
  const dialog = page.getByRole("dialog", {
    name: "プロフィール画像の範囲を選ぶ",
  });
  await expect(dialog).toBeVisible();
  // 画像の読み込みが終わると react-easy-crop が切り抜き枠を描画する
  await expect(dialog.locator('[data-testid="cropper"]')).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "この範囲で決定する" }),
  ).toBeEnabled();
  await takeSnapshot(page, testInfo, { fullPage: false });
});

test("タイムライン（何もないケース）の見た目", async ({ page }, testInfo) => {
  await page.goto(`/cats/${EMPTY_CAT}/timeline?ym=${YM}`);
  await expect(
    page.getByRole("heading", { name: "VRT空猫のタイムライン" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("タイムライン（データがあるケース）の見た目", async ({
  page,
}, testInfo) => {
  await page.goto(`/cats/${CAT}/timeline?ym=${YM}`);
  await expect(
    page.getByRole("heading", { name: "VRTテスト猫のタイムライン" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("タイムライン（あいまいモードのごはん記録）の見た目", async ({
  page,
}, testInfo) => {
  await page.goto(`/cats/${APPROXIMATE_CAT}/timeline?ym=${YM}`);
  await expect(
    page.getByRole("heading", { name: "VRTあいまい猫のタイムライン" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// スマートフォン幅ではカレンダーのマスが狭く、アイコンと「+1」が複数行に折り返す。
// マスの下端に余白が残る（中身がはみ出さない）ことを確認する
test.describe("タイムライン（スマートフォン幅）", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("1日の記録が多いケースの見た目", async ({ page }, testInfo) => {
    await page.goto(`/cats/${BUSY_CAT}/timeline?ym=${YM}`);
    await expect(
      page.getByRole("heading", { name: "VRT記録多数猫のタイムライン" }),
    ).toBeVisible();
    await expect(page.getByText("+1", { exact: true })).toBeVisible();
    await takeSnapshot(page, testInfo);
  });
});

type RecordListCase = {
  label: string;
  path: string;
  heading: string;
  /**
   * ごはん記録・うんち記録のグラフはデフォルトで折りたたまれている
   * (react-aria-components の Disclosure, defaultExpanded={false})。
   * 体重記録のグラフは折りたたみを持たないため未指定でよい
   */
  chartDisclosureTitle?: string;
};

// チャート (1m/3m/all の期間タブ) を持つ記録一覧。「データがあるケース」では
// 実行日時からの相対期間 (デフォルト3ヶ月) の外に固定データが出てしまうため、
// 「全期間」タブに切り替えてから撮影する
const CHART_RECORD_LISTS: RecordListCase[] = [
  {
    label: "体重記録",
    path: "weight-records",
    heading: "の体重記録",
  },
  {
    label: "ごはん記録",
    path: "feeding-records",
    heading: "のごはん記録",
    chartDisclosureTitle: "ごはんの推移",
  },
  {
    label: "うんち記録",
    path: "poop-records",
    heading: "のうんち記録",
    chartDisclosureTitle: "うんちの時間帯",
  },
];

for (const {
  label,
  path,
  heading,
  chartDisclosureTitle,
} of CHART_RECORD_LISTS) {
  test(`${label}一覧（何もないケース）の見た目`, async ({ page }, testInfo) => {
    await page.goto(`/cats/${EMPTY_CAT}/${path}`);
    await expect(
      page.getByRole("heading", { name: `VRT空猫${heading}` }),
    ).toBeVisible();
    await takeSnapshot(page, testInfo);
  });

  test(`${label}一覧（データがあるケース）の見た目`, async ({
    page,
  }, testInfo) => {
    await page.goto(`/cats/${CAT}/${path}`);
    await expect(
      page.getByRole("heading", { name: `VRTテスト猫${heading}` }),
    ).toBeVisible();
    if (chartDisclosureTitle) {
      await page.getByRole("button", { name: chartDisclosureTitle }).click();
    }
    await page.getByRole("radio", { name: "全期間" }).click();
    await expect(page.locator("svg").first()).toBeVisible();
    // Nivo のグラフ描画アニメーションが収まるのを待つ
    await page.waitForTimeout(500);
    await takeSnapshot(page, testInfo);
  });
}

// あいまいモードの記録は食べた量・カロリーを計算しないため、あいまいモードの記録しかない
// 猫ではグラフ（「ごはんの推移」）を表示しない
test("ごはん記録一覧（あいまいモードの記録だけのケース）の見た目", async ({
  page,
}, testInfo) => {
  await page.goto(`/cats/${APPROXIMATE_CAT}/feeding-records`);
  await expect(
    page.getByRole("heading", { name: "VRTあいまい猫のごはん記録" }),
  ).toBeVisible();
  await expect(page.getByText("あいまいモード")).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// チャートを持たない、猫1匹に対して単純な一覧を表示する記録
const FLAT_RECORD_LISTS: RecordListCase[] = [
  { label: "水分記録", path: "water-records", heading: "の水の記録" },
  { label: "嘔吐記録", path: "vomit-records", heading: "の嘔吐記録" },
  {
    label: "シャンプー記録",
    path: "shampoo-records",
    heading: "のシャンプー記録",
  },
  { label: "症状記録", path: "symptoms", heading: "の症状記録" },
  { label: "服薬予定", path: "medications", heading: "の服薬予定" },
];

for (const { label, path, heading } of FLAT_RECORD_LISTS) {
  test(`${label}一覧（何もないケース）の見た目`, async ({ page }, testInfo) => {
    await page.goto(`/cats/${EMPTY_CAT}/${path}`);
    await expect(
      page.getByRole("heading", { name: `VRT空猫${heading}` }),
    ).toBeVisible();
    await takeSnapshot(page, testInfo);
  });

  test(`${label}一覧（データがあるケース）の見た目`, async ({
    page,
  }, testInfo) => {
    await page.goto(`/cats/${CAT}/${path}`);
    await expect(
      page.getByRole("heading", { name: `VRTテスト猫${heading}` }),
    ).toBeVisible();

    if (path === "shampoo-records") {
      // 経過日数だけを既存のベースライン撮影日 (2026-09-22) の値に揃える。
      const elapsedDays = page.locator('[class*="elapsed"] strong');
      await expect(elapsedDays).toHaveText(/^\d+$/);
      await elapsedDays.evaluate((element) => {
        element.textContent = "836";
      });
    }

    await takeSnapshot(page, testInfo);
  });
}

// 直近365日のカレンダーグラフを持つ記録一覧。グラフ部分は実行日時に依存するため
// ignoreSelectors で除外する（「データがあるケース」のみ、グラフはデータがある
// ときだけ描画されるため）
test("通院記録一覧（何もないケース）の見た目", async ({ page }, testInfo) => {
  await page.goto(`/cats/${EMPTY_CAT}/hospital-visits`);
  await expect(
    page.getByRole("heading", { name: "VRT空猫の通院記録" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// カレンダーグラフ (直近365日のヒートマップ) は実行日時に依存するため
// ignoreSelectors で除外する。データがあるときだけ描画されるため、
// このケースにのみ必要
test.describe("通院記録一覧（データがあるケース）", () => {
  test.use({
    ignoreSelectors: ['section[aria-label="通院日カレンダーグラフ"]'],
  });

  test("見た目", async ({ page }, testInfo) => {
    await page.goto(`/cats/${CAT}/hospital-visits`);
    await expect(
      page.getByRole("heading", { name: "VRTテスト猫の通院記録" }),
    ).toBeVisible();
    await takeSnapshot(page, testInfo);
  });
});

test("掃除記録一覧（何もないケース）の見た目", async ({ page }, testInfo) => {
  await page.goto(`/cats/${EMPTY_CAT}/cleaning`);
  await expect(
    page.getByRole("heading", { name: "VRT空猫の掃除記録" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("掃除記録一覧（データがあるケース）の見た目", async ({
  page,
}, testInfo) => {
  await page.goto(`/cats/${CAT}/cleaning`);
  await expect(
    page.getByRole("heading", { name: "VRTテスト猫の掃除記録" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("掃除の実施記録（対象ごと・何もないケース）の見た目", async ({
  page,
}, testInfo) => {
  await page.goto(`/cats/${CAT}/cleaning/targets/vrt-clean-target-2/records`);
  await expect(
    page.getByRole("heading", { name: "ケージ掃除の実施記録" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// こちらもカレンダーグラフがデータがあるときだけ描画されるため、このケースにのみ除外が必要
test.describe("掃除の実施記録（対象ごと・データがあるケース）", () => {
  test.use({
    ignoreSelectors: ['section[aria-label="実施日カレンダーグラフ"]'],
  });

  test("見た目", async ({ page }, testInfo) => {
    await page.goto(`/cats/${CAT}/cleaning/targets/vrt-clean-target-1/records`);
    await expect(
      page.getByRole("heading", { name: "トイレ掃除の実施記録" }),
    ).toBeVisible();
    await takeSnapshot(page, testInfo);
  });
});

test("投薬実績一覧（データがあるケース）の見た目", async ({
  page,
}, testInfo) => {
  await page.goto(`/cats/${CAT}/medications/vrt-med-1/doses`);
  await expect(
    page.getByRole("heading", { name: "VRT抗生剤の投薬実績" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("投薬実績一覧（何もないケース）の見た目", async ({ page }, testInfo) => {
  await page.goto(`/cats/${CAT}/medications/vrt-med-2/doses`);
  await expect(
    page.getByRole("heading", { name: "VRT整腸剤の投薬実績" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("支出記録（何もないケース）の見た目", async ({ page }, testInfo) => {
  await page.goto(`/cats/${EMPTY_CAT}/expenses?ym=${YM}&scope=cat`);
  await expect(page.getByRole("heading", { name: "支出記録" })).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("支出記録（データがあるケース）の見た目", async ({ page }, testInfo) => {
  await page.goto(`/cats/${CAT}/expenses?ym=${YM}&scope=cat`);
  await expect(page.getByRole("heading", { name: "支出記録" })).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("服薬予定登録ページの見た目", async ({ page }, testInfo) => {
  await page.goto(`/cats/${EMPTY_CAT}/medications/new`);
  await expect(
    page.getByRole("heading", { name: "VRT空猫の服薬予定を登録する" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("掃除対象登録ページの見た目", async ({ page }, testInfo) => {
  await page.goto(`/cats/${EMPTY_CAT}/cleaning/targets/new`);
  await expect(
    page.getByRole("heading", { name: "VRT空猫の掃除対象を追加する" }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// 日付・時刻欄の初期値が実行日時 (`new Date()`) になる記録追加ページ。
// その入力欄だけ ignoreSelectors で除外する
test.describe("記録追加ページ（日付欄あり）", () => {
  test.use({
    ignoreSelectors: ['input[type="date"]', 'input[type="time"]'],
  });

  const NEW_RECORD_PAGES: { label: string; path: string; heading: string }[] = [
    {
      label: "体重記録",
      path: "weight-records/new",
      heading: "体重を記録する",
    },
    { label: "水分記録", path: "water-records/new", heading: "水を記録する" },
    {
      label: "うんち記録",
      path: "poop-records/new",
      heading: "うんちを記録する",
    },
    { label: "嘔吐記録", path: "vomit-records/new", heading: "嘔吐を記録する" },
    {
      label: "シャンプー記録",
      path: "shampoo-records/new",
      heading: "シャンプーを記録する",
    },
    { label: "症状記録", path: "symptoms/new", heading: "症状を記録する" },
    {
      label: "通院記録",
      path: "hospital-visits/new",
      heading: "通院を記録する",
    },
    {
      label: "ごはん記録",
      path: "feeding-records/new",
      heading: "ごはんを記録する",
    },
    { label: "支出記録", path: "expenses/new", heading: "支出を記録する" },
  ];

  for (const { label, path, heading } of NEW_RECORD_PAGES) {
    test(`${label}追加ページの見た目`, async ({ page }, testInfo) => {
      await page.goto(`/cats/${EMPTY_CAT}/${path}`);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await takeSnapshot(page, testInfo);
    });
  }

  // 記録方法を「あいまいモード」に切り替え、与えた量・残した量が段階の選択肢になった
  // 状態を撮る。保存はしないため、フィクスチャのデータは変わらない
  test("ごはん記録追加ページ（あいまいモード）の見た目", async ({
    page,
  }, testInfo) => {
    await page.goto(`/cats/${EMPTY_CAT}/feeding-records/new`);
    await expect(
      page.getByRole("heading", { name: "ごはんを記録する" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "あいまいモード" }).click();
    await expect(
      page.getByRole("radiogroup", { name: "残した量" }).first(),
    ).toBeVisible();
    await takeSnapshot(page, testInfo);
  });

  test("投薬実績追加ページの見た目", async ({ page }, testInfo) => {
    await page.goto(`/cats/${CAT}/medications/vrt-med-1/doses/new`);
    await expect(
      page.getByRole("heading", { name: "VRT抗生剤の投薬実績を記録する" }),
    ).toBeVisible();
    await takeSnapshot(page, testInfo);
  });

  test("掃除の実施記録追加ページの見た目", async ({ page }, testInfo) => {
    await page.goto(
      `/cats/${CAT}/cleaning/targets/vrt-clean-target-1/records/new`,
    );
    await expect(
      page.getByRole("heading", { name: "トイレ掃除を記録する" }),
    ).toBeVisible();
    await takeSnapshot(page, testInfo);
  });
});

// 支出日を固定の日付にしてからカテゴリ「病院」を選び、同じ日の通院記録が紐付けの候補に並ぶ状態を撮る。
// 保存はしないため、フィクスチャのデータは変わらない
test("支出記録追加ページ（カテゴリ「病院」）の見た目", async ({
  page,
}, testInfo) => {
  await page.goto(`/cats/${CAT}/expenses/new`);
  await expect(
    page.getByRole("heading", { name: "支出を記録する" }),
  ).toBeVisible();
  await fillAndKeep(page.getByLabel("支出日"), "2024-06-05");
  await page.getByRole("button", { name: /カテゴリ/ }).click();
  await page.getByRole("option", { name: "病院" }).click();
  await expect(
    page.getByRole("checkbox", { name: /VRTテスト猫：定期健診/ }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// 受診日をフィクスチャの「病院」の支出記録（2件）と同じ日にして記録すると、紐付けるかを確認する
// モーダルが開く。モーダルを開くだけで保存はしないため、フィクスチャのデータは変わらない
test("通院記録の作成時の支出記録との紐付け確認モーダルの見た目", async ({
  page,
}, testInfo) => {
  await page.goto(`/cats/${EMPTY_CAT}/hospital-visits/new`);
  await expect(
    page.getByRole("heading", { name: "VRT空猫の通院を記録する" }),
  ).toBeVisible();
  // 受診日時の初期値は実行日時になるため、固定の値を入れる（ignoreSelectors のマスクは
  // モーダルの上にも描画されてしまうため使わない）
  await fillAndKeep(page.getByLabel("受診日"), "2024-05-20");
  await fillAndKeep(page.getByLabel("受診時刻"), "10:00");
  await page.getByLabel("受診理由").fill("ワクチン接種");
  await page.getByRole("button", { name: "記録する", exact: true }).click();

  const dialog = page.getByRole("dialog", {
    name: "支出記録と紐付けますか？",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio")).toHaveCount(2);
  await takeSnapshot(page, testInfo, { fullPage: false });
});
