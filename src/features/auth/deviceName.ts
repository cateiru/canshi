/** セッションに保存する User-Agent の最大長。ブラウザが自由に送れる値のため、長すぎる分は切り捨てる */
export const MAX_USER_AGENT_LENGTH = 512;

/** User-Agent を保存できる形にする。空なら null */
export function normalizeUserAgent(
  userAgent: string | null | undefined,
): string | null {
  const trimmed = userAgent?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, MAX_USER_AGENT_LENGTH);
}

/** 上から順に判定する。iPad・iPhone の UA にも「Mac OS X」が含まれるため、Mac より先に見る */
const OS_PATTERNS: [RegExp, string][] = [
  [/iPhone|iPod/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "Mac"],
  [/Linux/, "Linux"],
];

/**
 * 上から順に判定する。Edge・Opera・Samsung Internet の UA にも「Chrome」が、Chrome の UA にも
 * 「Safari」が含まれるため、派生ブラウザ → Chrome → Safari の順に見る。iOS の Chrome・Firefox・
 * Edge は「CriOS」「FxiOS」「EdgiOS」を送る
 */
const BROWSER_PATTERNS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\/|Chromium\//, "Chrome"],
  [/Safari\//, "Safari"],
];

function findLabel(userAgent: string, patterns: [RegExp, string][]) {
  return patterns.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

/**
 * User-Agent を「iPhone・Safari」のような人が読める端末名にする。OS のバージョンは出さない
 * （ブラウザが UA の情報を減らしており、Windows 11 も「Windows NT 10.0」、macOS も 10_15_7 固定の
 * ため正しく出せない）。iPadOS の Safari は Mac と同じ UA を送るため「Mac」になる。
 * User-Agent がない（端末一覧の追加前のセッション）・判定できないときは「不明な端末」
 */
export function formatDeviceName(userAgent: string | null): string {
  if (!userAgent) {
    return "不明な端末";
  }
  const os = findLabel(userAgent, OS_PATTERNS);
  const browser = findLabel(userAgent, BROWSER_PATTERNS);
  if (os && browser) {
    return `${os}・${browser}`;
  }
  return os ?? browser ?? "不明な端末";
}
