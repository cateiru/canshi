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
const YM = "2024-06";

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

test("設定ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "設定", exact: true }),
  ).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("通知設定ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/settings/notifications");
  await expect(page.getByRole("heading", { name: "通知設定" })).toBeVisible();
  await takeSnapshot(page, testInfo);
});

test("更新情報ページの見た目", async ({ page }, testInfo) => {
  await page.goto("/release-notes");
  await expect(page.getByRole("heading", { name: "更新情報" })).toBeVisible();
  await takeSnapshot(page, testInfo);
});

// 猫の年齢・お迎えからの日数は実行日時から計算されるため、その部分だけ除外する
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
  { label: "写真", path: "photos", heading: "の写真" },
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
    { label: "写真", path: "photos/new", heading: "写真を追加する" },
    { label: "支出記録", path: "expenses/new", heading: "支出を記録する" },
  ];

  for (const { label, path, heading } of NEW_RECORD_PAGES) {
    test(`${label}追加ページの見た目`, async ({ page }, testInfo) => {
      await page.goto(`/cats/${EMPTY_CAT}/${path}`);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await takeSnapshot(page, testInfo);
    });
  }

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
