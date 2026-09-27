/**
 * フォーム送信後の画面遷移で「直前の履歴エントリ」に戻るか、今のエントリを置き換えるかを
 * 判断するための履歴の追跡状態。
 *
 * ブラウザは直前の履歴エントリの URL を教えてくれないため、アプリ内の遷移を
 * `NavigationTracker` が sessionStorage に記録し、送信後の遷移（`useNavigateAfterSubmit`）が
 * それを読んで判断する。追跡が確実でない場合は `previous` を `null` にし、
 * 送信後は必ず置き換え（replace）に倒す
 */

/** 現在の履歴エントリの位置（pathname + search）と、その直前のエントリの位置 */
export type TrackedEntry = {
  current: string;
  previous: string | null;
};

/**
 * 送信後の遷移で予約した処理。遷移先に到着したときに `NavigationTracker` が消費する。
 * - `back`: 直前のエントリへ戻った。到着したら最新の内容に更新する
 * - `replace`: 今のエントリを置き換えた。置き換え後のエントリの直前は置き換え前と同じ
 */
export type PendingNavigation = {
  type: "back" | "replace";
  href: string;
};

export type SubmitNavigation = "back" | "replace";

const ENTRY_KEY = "canshi:navigation:entry";
const PENDING_KEY = "canshi:navigation:pending";

/** URL（相対パス可）から pathname だけを取り出す */
export function toPathname(href: string): string {
  return new URL(href, "http://localhost").pathname;
}

/**
 * アプリ内で位置が変わったときの新しい追跡状態を求める。
 * - 同じ位置（再読み込みや React の effect の再実行）なら記録をそのまま使う
 * - 置き換えなら、置き換え前のエントリの直前を引き継ぐ
 * - 戻る・進むで来た場合は直前のエントリが分からないため `null` にする
 * - それ以外（リンクなどによる push）なら、直前に記録していた位置が直前のエントリになる
 */
export function nextTrackedEntry(
  stored: TrackedEntry | null,
  current: string,
  options: { replaced: boolean; popped: boolean },
): TrackedEntry {
  if (stored?.current === current) {
    return stored;
  }
  if (options.replaced) {
    return { current, previous: stored?.previous ?? null };
  }
  if (options.popped || stored === null) {
    return { current, previous: null };
  }
  return { current, previous: stored.current };
}

/**
 * 送信後に `href` へ遷移する方法を決める。
 * 直前のエントリが遷移先のページ（pathname が一致）なら戻る。
 * 追跡状態が今の位置のものでない場合や、直前のエントリが分からない場合は置き換える
 */
export function decideSubmitNavigation(
  entry: TrackedEntry | null,
  current: string,
  href: string,
): SubmitNavigation {
  if (entry === null || entry.current !== current || entry.previous === null) {
    return "replace";
  }
  const target = toPathname(href);
  if (target === toPathname(current)) {
    return "replace";
  }
  return toPathname(entry.previous) === target ? "back" : "replace";
}

function readJson<T>(key: string): T | null {
  try {
    const value = window.sessionStorage.getItem(key);
    return value === null ? null : (JSON.parse(value) as T);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // プライベートブラウズなどで保存できない場合は追跡しない（送信後は常に置き換えになる）
  }
}

export function readTrackedEntry(): TrackedEntry | null {
  return readJson<TrackedEntry>(ENTRY_KEY);
}

export function writeTrackedEntry(entry: TrackedEntry): void {
  writeJson(ENTRY_KEY, entry);
}

export function readPendingNavigation(): PendingNavigation | null {
  return readJson<PendingNavigation>(PENDING_KEY);
}

export function writePendingNavigation(pending: PendingNavigation | null) {
  writeJson(PENDING_KEY, pending);
}

/** 今の位置を追跡状態と同じ形式（pathname + search）で返す */
export function currentLocation(): string {
  return `${window.location.pathname}${window.location.search}`;
}
