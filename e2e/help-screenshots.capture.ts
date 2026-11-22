import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  HELP_SCREENSHOT_NAMES,
  type HelpScreenshotName,
} from "../src/features/help/screenshots";
import {
  encodeMcpConsentRequest,
  MCP_CONSENT_HEADER,
} from "../src/features/mcp/presentation/consent";
import { fillAndKeep, quitTourGuide } from "./helpers";

// ヘルプ（`/help/*`）に載せるスクリーンショットを撮る。`pnpm help:screenshots` で実行する
// （playwright.help-screenshots.config.ts）。
//
// 毎回新しいユーザーでログインし、家の作成・ねこの登録・ごはんの設定・記録を実際に操作しながら、
// 各画面を `public/images/help/<name>.webp` に書き出す。撮る画像の名前は
// `src/features/help/screenshots.ts` の HELP_SCREENSHOT_NAMES と揃える。
//
// ローカルの D1 に書き込むため、事前に `pnpm db:migrate:local` を実行しておくこと。
// 日付は撮影した日の日付になる（VRT と違い、撮るたびに同じ画像になることは求めない）。

const OUTPUT_DIR = path.join(process.cwd(), "public/images/help");

/** 押す場所を示す枠の色。どのテーマ色とも見分けやすい色にする */
const HIGHLIGHT_COLOR = "#e8590c";

const USER_NAME = "ねこ好き";
/** 招待された家族の名前 */
const INVITEE_NAME = "ねこ好きの家族";
const HOUSEHOLD_NAME = "わが家";
const CAT_NAME = "こむぎ";
const FOOD_PRODUCT_NAME = "ドライフード チキン味";
const PRESET_NAME = "朝ごはん";

const JAPANESE_FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=block";

const captured = new Set<HelpScreenshotName>();

/** 撮影の邪魔になる要素（開発用のオーバーレイ・遷移中のバー）を隠す */
async function hideOverlays(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal, .bprogress { display: none !important; }",
  });
}

/**
 * 日本語のフォントを Noto Sans JP（アプリのフォントの指定にも含まれる）にそろえる。
 * フォントの指定の先頭は system-ui のため、撮影する環境の既定のフォントで描かれ、Linux では
 * 中国語のフォントの字形になることがある。環境によらず同じ見た目で撮れるよう、Web フォントを読み込む
 */
async function applyJapaneseFont(page: Page) {
  await page.addStyleTag({
    content: `@import url("${JAPANESE_FONT_CSS_URL}");
:root { --font-sans: "Noto Sans JP", sans-serif !important; }
input, textarea, select, button { font-family: inherit; }`,
  });
  await page.evaluate(async () => {
    // 画面にある文字の分だけ読み込まれるため、表示中の文字を指定して読み込みを待つ
    const text = document.body.textContent ?? "";
    await Promise.all(
      ["400", "700"].map((weight) =>
        document.fonts.load(`${weight} 16px "Noto Sans JP"`, text),
      ),
    );
    await document.fonts.ready;
  });
}

/** 押す場所を枠で囲む */
async function highlight(locator: Locator) {
  await locator.evaluate((element, color) => {
    const target = element as HTMLElement;
    target.style.outline = `3px solid ${color}`;
    target.style.outlineOffset = "3px";
    target.style.borderRadius ||= "8px";
  }, HIGHLIGHT_COLOR);
}

/**
 * 画面に見えている範囲を撮り、WebP にして保存する。PNG より小さくするため、
 * 撮った PNG をブラウザの canvas で WebP に変換する
 */
async function capture(page: Page, name: HelpScreenshotName) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await hideOverlays(page);
  await applyJapaneseFont(page);
  // 最後に入力した欄のフォーカスの枠が写らないようにする（押す場所は highlight の枠で示す）
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  const png = await page.screenshot({ animations: "disabled" });
  const converter = await page.context().newPage();
  try {
    const dataUrl = await converter.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      return canvas.toDataURL("image/webp", 0.9);
    }, png.toString("base64"));
    const webp = Buffer.from(
      dataUrl.replace(/^data:image\/webp;base64,/, ""),
      "base64",
    );
    await writeFile(path.join(OUTPUT_DIR, `${name}.webp`), webp);
    captured.add(name);
  } finally {
    await converter.close();
  }
}

/** 見出しが画面の上端に来るようにスクロールする（サイトのヘッダーの分だけ余白を空ける） */
async function scrollToTop(locator: Locator) {
  await locator.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top, behavior: "instant" });
  });
}

/** 入力欄の値を、ハイドレーションで初期値に戻されないように入れる */
async function fill(page: Page, label: string, value: string) {
  await fillAndKeep(page.getByLabel(label, { exact: true }), value);
}

async function selectOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).first().click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/**
 * 招待された家族として、招待 URL を開いたときの画面を撮る。撮影するユーザーとは別の新しいユーザーで
 * ログインし、ウェルカムモーダルの「もっている」から招待 URL を開く。家の中身が変わらないよう、
 * 「参加する」は押さない
 */
async function captureInvitationAsInvitee(
  browser: Browser,
  invitationPath: string,
) {
  const { baseURL, viewport, deviceScaleFactor, locale, timezoneId } =
    test.info().project.use;
  const context = await browser.newContext({
    baseURL,
    viewport,
    deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    locale,
    timezoneId,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await fillAndKeep(
      page.getByLabel("メールアドレス（開発用）"),
      `help-invitee-${Date.now()}@example.com`,
    );
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).not.toHaveURL(/\/login/);

    const welcome = page.getByRole("dialog", {
      name: "アカウントを作成いただきありがとうございます！",
    });
    const welcomeInvitation = page.getByRole("dialog", {
      name: "もっている招待URLを入力してください",
    });
    // ハイドレーション前に押すと反応しないため、入力画面に変わるまで押し直す
    await expect(async () => {
      if (await welcome.isVisible()) {
        await welcome.getByRole("button", { name: "もっている" }).click();
      }
      await expect(welcomeInvitation).toBeVisible({ timeout: 2000 });
    }).toPass();
    await fillAndKeep(
      welcomeInvitation.getByRole("textbox", { name: "招待URL" }),
      new URL(invitationPath, page.url()).toString(),
    );
    await welcomeInvitation.getByRole("button", { name: "適用" }).click();
    await expect(page).toHaveURL(invitationPath);

    // 図に出る名前を、メールアドレスから作られた名前ではなく家族らしい名前にする
    await page.goto("/settings/account/profile");
    await fillAndKeep(
      page.getByRole("textbox", { name: "名前" }),
      INVITEE_NAME,
    );
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page).toHaveURL("/settings/account");

    await page.goto(invitationPath);
    const joinButton = page.getByRole("button", { name: "参加する" });
    await expect(joinButton).toBeVisible();
    await highlight(joinButton);
    await capture(page, "household-join");
  } finally {
    await context.close();
  }
}

test("ヘルプのスクリーンショットを撮る", async ({ page, browser }) => {
  test.setTimeout(15 * 60 * 1000);
  await mkdir(OUTPUT_DIR, { recursive: true });

  // ログイン前の、ログイン画面から見た目設定への導線
  await page.goto("/login");
  const appearanceLink = page.getByRole("link", {
    name: "見た目設定（文字の大きさ・配色）",
  });
  await expect(appearanceLink).toBeVisible();
  // 撮影は開発用のログイン（メールアドレスの入力欄）で行うため、本番と同じく
  // 「ログイン」ボタンだけが見えるように入力欄を隠して撮る
  await page.getByLabel("メールアドレス（開発用）").evaluate((input) => {
    // フォームの直下にある、入力欄のまとまり（ラベルを含む）を隠す
    let field: Element = input;
    while (field.parentElement && field.parentElement.tagName !== "FORM") {
      field = field.parentElement;
    }
    (field as HTMLElement).style.display = "none";
  });
  await highlight(appearanceLink);
  await capture(page, "login-appearance-link");

  // ウェルカムモーダルの紙吹雪（canvas）が写らないよう、動きを減らす設定にする
  await page.emulateMedia({ reducedMotion: "reduce" });
  // 毎回新しいユーザーにして、前回撮ったときのデータが写らないようにする
  await page.goto("/login");
  await fillAndKeep(
    page.getByLabel("メールアドレス（開発用）"),
    `help-${Date.now()}@example.com`,
  );
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  // はじめてログインしたユーザーに出るウェルカムモーダル
  const welcome = page.getByRole("dialog", {
    name: "アカウントを作成いただきありがとうございます！",
  });
  const welcomeInvitation = page.getByRole("dialog", {
    name: "もっている招待URLを入力してください",
  });
  await expect(welcome).toBeVisible();
  await highlight(welcome.getByRole("button", { name: "もっている" }));
  await capture(page, "welcome-modal");
  // ハイドレーション前に押すと反応しないため、入力画面に変わるまで押し直す
  await expect(async () => {
    if (await welcome.isVisible()) {
      await welcome.getByRole("button", { name: "もっている" }).click();
    }
    await expect(welcomeInvitation).toBeVisible({ timeout: 2000 });
  }).toPass();
  await fillAndKeep(
    welcomeInvitation.getByRole("textbox", { name: "招待URL" }),
    "https://canshi.example.com/invitations/xxxxxxxx",
  );
  await highlight(welcomeInvitation.getByRole("button", { name: "適用" }));
  await capture(page, "welcome-invitation");
  // 右上の ✕ で、もっているかどうかの選択に戻る
  await welcomeInvitation.getByRole("button", { name: "閉じる" }).click();

  // ウェルカムモーダルとはじめてガイドのパネルが、ほかの画面に写らないようにする
  await quitTourGuide(page);

  await page.goto("/settings/account/profile");
  await fillAndKeep(page.getByRole("textbox", { name: "名前" }), USER_NAME);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL("/settings/account");

  // 家の作成
  await page.goto("/cats");
  const createHouseholdLink = page.getByRole("link", { name: "家を作成する" });
  await expect(createHouseholdLink).toBeVisible();
  await highlight(createHouseholdLink);
  await capture(page, "cats-empty");

  await page.goto("/settings/households/new?from=cats");
  await fill(page, "家の名前", HOUSEHOLD_NAME);
  const createHouseholdButton = page.getByRole("button", {
    name: "家を作成する",
  });
  await highlight(createHouseholdButton);
  await capture(page, "household-new");
  await createHouseholdButton.click();
  await expect(page).toHaveURL(/\/cats$/);

  await page.goto("/settings/households");
  await page.getByRole("link", { name: new RegExp(HOUSEHOLD_NAME) }).click();
  await expect(page).toHaveURL(/\/settings\/households\/[^/]+$/);
  const householdId = page.url().split("/").at(-1) as string;
  await expect(
    page.getByRole("heading", { level: 1, name: HOUSEHOLD_NAME }),
  ).toBeVisible();
  await capture(page, "household-detail");

  const issueButton = page.getByRole("button", { name: "招待 URL を発行する" });
  await expect(async () => {
    await issueButton.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  // 招待された家族が開く画面を撮るため、置き換える前の招待 URL を控えておく
  const invitationPath = new URL(
    await page.getByRole("dialog").getByLabel("招待 URL").inputValue(),
  ).pathname;
  // 招待 URL は撮るたびに変わり、開発環境のアドレスでもあるため、例の URL に置き換えて撮る
  await page
    .getByRole("dialog")
    .getByLabel("招待 URL")
    .evaluate((input) => {
      (input as HTMLInputElement).value =
        "https://canshi.app/invitations/xxxxxxxxxxxxxxxx";
    });
  await capture(page, "household-invitation");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // 招待された家族が招待 URL を開いた画面。別の新しいユーザーで、ウェルカムモーダルから開く
  await captureInvitationAsInvitee(browser, invitationPath);

  // ねこの登録
  await page.goto(`/cats/new?householdId=${householdId}`);
  await fill(page, "名前", CAT_NAME);
  await selectOption(page, "性別", "メス");
  await capture(page, "cat-new");
  await page.getByRole("button", { name: "登録する" }).click();
  await page.waitForURL(
    (url) =>
      /^\/cats\/[^/]+$/.test(url.pathname) && url.pathname !== "/cats/new",
  );
  const catPath = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: CAT_NAME })).toBeVisible();
  await capture(page, "cat-detail");

  // ごはんの設定
  await page.goto(`/food-products/add?householdId=${householdId}`);
  await expect(
    page.getByRole("link", { name: /共通のごはん商品から探す/ }),
  ).toBeVisible();
  await capture(page, "food-product-add");

  await page.goto(`/food-products/new?householdId=${householdId}`);
  await fill(page, "商品名", FOOD_PRODUCT_NAME);
  await fill(page, "メーカー名（任意）", "ねこフード");
  await fill(page, "カロリー（kcal/100g）", "380");
  await fill(page, "内容量（g）", "1500");
  await capture(page, "food-product-new");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/food-products/);
  await expect(page.getByText(FOOD_PRODUCT_NAME)).toBeVisible();

  await page.goto(`/settings/households/${householdId}/feeding-schedules`);
  for (const time of ["07:00", "19:00"]) {
    await selectOption(page, "時刻（日本時間）", time);
    await page.getByRole("button", { name: "追加する" }).click();
    await expect(
      page.getByRole("article", { name: `${time}のごはんの時間` }),
    ).toBeVisible();
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await capture(page, "feeding-schedules");

  await page.goto(`/feeding-presets/new?householdId=${householdId}`);
  await fill(page, "プリセット名", PRESET_NAME);
  await selectOption(page, "商品", FOOD_PRODUCT_NAME);
  await fillAndKeep(page.getByLabel("与える量（g）"), "30");
  await capture(page, "feeding-preset-new");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/\/feeding-presets(\?.*)?$/);

  // ごはん記録
  await page.goto(`${catPath}/feeding-records/new`);
  const presetButton = page.getByRole("button", { name: PRESET_NAME });
  await expect(async () => {
    await presetButton.click();
    await expect(page.getByLabel("与えた量（g）")).toHaveValue("30", {
      timeout: 1000,
    });
  }).toPass({ timeout: 30_000 });
  await highlight(presetButton);
  await capture(page, "record-feeding");
  await presetButton.evaluate((element) => {
    (element as HTMLElement).style.outline = "";
  });
  await fillAndKeep(page.getByLabel("残した量（g）"), "5");
  await scrollToTop(page.getByRole("radio", { name: "厳格モード" }));
  await capture(page, "feeding-mode-strict");
  await page.getByRole("radio", { name: "あいまいモード" }).click();
  await page
    .getByRole("radiogroup", { name: "残した量" })
    .locator("label", { hasText: "少し残し" })
    .click();
  await scrollToTop(page.getByRole("radio", { name: "厳格モード" }));
  await capture(page, "feeding-mode-approximate");
  await page.getByRole("radio", { name: "厳格モード" }).click();
  await fillAndKeep(page.getByLabel("与えた量（g）"), "30");
  await fillAndKeep(page.getByLabel("残した量（g）"), "5");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/feeding-records$/);

  // うんち記録（記録して一覧も撮る）
  await page.goto(`${catPath}/poop-records/new`);
  await fill(page, "量", "ふつう");
  await fill(page, "色", "茶色");
  await capture(page, "record-poop");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/poop-records$/);
  await highlight(page.getByRole("link", { name: "記録する" }));
  await capture(page, "record-list");

  await page.goto(`${catPath}/weight-records/new`);
  // ラジオボタンの input はラベルの下に隠れているため、ラベルを押す
  await page.locator("label", { hasText: "ねこの体重を直接入力" }).click();
  await fill(page, "ねこの体重（kg）", "4.20");
  await capture(page, "record-weight");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/weight-records$/);

  await page.goto(`${catPath}/vomit-records/new`);
  await fill(page, "量", "少なめ");
  await fill(page, "色", "黄色");
  await capture(page, "record-vomit");

  await page.goto(`${catPath}/water-records/new`);
  await fill(page, "給水量（ml）", "200");
  await fill(page, "残量（ml）", "120");
  await capture(page, "record-water");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/water-records$/);

  await page.goto(`${catPath}/shampoo-records/new`);
  await capture(page, "record-shampoo");

  await page.goto(`${catPath}/brushing-records/new`);
  await fill(page, "時間（分）", "10");
  await capture(page, "record-brushing");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/brushing-records$/);

  await page.goto(`${catPath}/cleaning/targets/new`);
  await expect(
    page.getByRole("heading", { name: "よく使う対象をワンタップで追加" }),
  ).toBeVisible();
  await capture(page, "record-cleaning");

  await page.goto(`${catPath}/symptoms/new`);
  await fill(page, "症状の種類", "くしゃみ");
  await capture(page, "record-symptoms");

  await page.goto(`${catPath}/medications/new`);
  await fill(page, "薬名", "目薬");
  await fill(page, "1回量", "1滴");
  await capture(page, "record-medications");

  await page.goto(`${catPath}/hospital-visits/new`);
  await fill(page, "受診理由", "ワクチン接種");
  await capture(page, "record-hospital-visits");

  await page.goto(`${catPath}/expenses/new`);
  await fill(page, "金額（円）", "3980");
  await capture(page, "record-expenses");

  await page.goto(`${catPath}/memo-records/new`);
  await fillAndKeep(
    page.getByRole("textbox", { name: "メモ" }),
    "窓辺で日向ぼっこするのがお気に入り",
  );
  await capture(page, "record-memo");

  await page.goto(`${catPath}/timeline`);
  await expect(
    page.getByRole("heading", { name: `${CAT_NAME}のタイムライン` }),
  ).toBeVisible();
  await capture(page, "timeline");

  // 記録の出力。記録をつけた後に出力し、出力するボタンと、完了した出力のダウンロードを撮る
  await page.goto(`/settings/households/${householdId}/record-exports`);
  const exportButton = page.getByRole("button", { name: "出力する" });
  await expect(exportButton).toBeEnabled();
  // 記録の選択と出力するボタンが両方写るよう、ボタンを画面の下端に合わせる
  await exportButton.evaluate((element) => {
    const bottom = element.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo({
      top: bottom + 24 - window.innerHeight,
      behavior: "instant",
    });
  });
  await highlight(exportButton);
  await capture(page, "record-exports");
  await exportButton.evaluate((element) => {
    (element as HTMLElement).style.outline = "";
  });
  await exportButton.click();
  const downloadLink = page.getByRole("link", { name: "ダウンロード" });
  await expect(downloadLink).toBeVisible({ timeout: 60_000 });
  await scrollToTop(page.getByRole("heading", { name: "出力したファイル" }));
  await highlight(downloadLink);
  await capture(page, "record-exports-download");

  // AI との接続の同意画面。本番では Worker が付けるヘッダーを、ここでは自分で付けて開く。
  // setExtraHTTPHeaders だとフォントなどほかのサイトへのリクエストにも付き、CORS で読み込めなく
  // なるため、同意画面へのリクエストだけに付ける。通知の撮影で Service Worker を登録すると、
  // リクエストが Service Worker を通って page.route で書き換えられなくなるため、通知より先に撮る
  const isConsentPage = (url: URL) => url.pathname === "/oauth/authorize";
  const consentHeader = encodeMcpConsentRequest({
    clientId: "help-client",
    clientName: "ChatGPT",
    redirectUri: "https://chatgpt.com/connector/oauth/callback",
  });
  await page.route(isConsentPage, (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        [MCP_CONSENT_HEADER]: consentHeader,
      },
    }),
  );
  await page.goto(
    "/oauth/authorize?response_type=code&client_id=help-client&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fconnector%2Foauth%2Fcallback&state=help",
  );
  await expect(page.getByRole("button", { name: "許可する" })).toBeVisible();
  await capture(page, "ai-consent");
  await page.unroute(isConsentPage);

  // 通知。next dev では Service Worker を登録しないため、通知の設定の確認が終わるよう自分で登録する
  await page.goto("/settings/notifications");
  await page.evaluate(() => navigator.serviceWorker.register("/sw.js"));
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "通知設定" }),
  ).toBeVisible();
  await expect(
    page.getByText("この端末の通知設定を確認しています"),
  ).toHaveCount(0);
  const pushToggle = page
    .locator("label")
    .filter({ hasText: "この端末で通知を受け取る" });
  await expect(pushToggle).toBeVisible();
  await highlight(pushToggle);
  await capture(page, "notification-settings");

  await page.goto(`${catPath}/notification-settings`);
  await expect(page.getByRole("button", { name: "保存する" })).toBeVisible();
  await capture(page, "cat-notification-settings");

  await page.goto("/settings/appearance");
  await expect(
    page.getByRole("heading", { level: 1, name: "見た目設定" }),
  ).toBeVisible();
  await capture(page, "appearance-settings");

  // ホーム画面への追加のバナー（Android）。撮影のブラウザでは `beforeinstallprompt` が発火しないため、
  // 同じイベントを発火してバナーを出す
  await page.goto("/cats");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const installButton = page.getByRole("button", { name: "追加する" });
  await expect(async () => {
    await page.evaluate(() => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt"), {
          prompt: async () => {},
          userChoice: new Promise(() => {}),
        }),
      );
    });
    await expect(installButton).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await highlight(installButton);
  await capture(page, "install-banner-android");

  // ホーム画面への追加のバナー（iOS）。iPhone の UA で、同じログインのまま開く
  const { baseURL, viewport, deviceScaleFactor, locale, timezoneId } =
    test.info().project.use;
  const iosContext = await browser.newContext({
    baseURL,
    viewport,
    deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    locale,
    timezoneId,
    colorScheme: "light",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    storageState: await page.context().storageState(),
  });
  try {
    const iosPage = await iosContext.newPage();
    await iosPage.goto("/cats");
    const howToLink = iosPage.getByRole("link", { name: "追加方法" });
    await expect(howToLink).toBeVisible();
    await highlight(howToLink);
    await capture(iosPage, "install-banner-ios");
  } finally {
    await iosContext.close();
  }

  // 撮り漏れがないことを確かめる
  expect(HELP_SCREENSHOT_NAMES.filter((name) => !captured.has(name))).toEqual(
    [],
  );
});
