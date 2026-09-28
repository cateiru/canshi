import { beforeEach, describe, expect, it } from "vitest";
import {
  decideSubmitNavigation,
  nextTrackedEntry,
  readPendingNavigation,
  readTrackedEntry,
  toPathname,
  writePendingNavigation,
  writeTrackedEntry,
} from "./history";

describe("toPathname", () => {
  it("search を除いた pathname を返す", () => {
    expect(toPathname("/cats/tama/expenses?month=2026-08")).toBe(
      "/cats/tama/expenses",
    );
  });
});

describe("nextTrackedEntry", () => {
  const stored = {
    current: "/cats/tama/weight-records",
    previous: "/cats/tama",
  };
  const push = { replaced: false, popped: false };

  it("リンクなどで遷移したら、直前に記録していた位置が直前のエントリになる", () => {
    expect(
      nextTrackedEntry(stored, "/cats/tama/weight-records/new", push),
    ).toEqual({
      current: "/cats/tama/weight-records/new",
      previous: "/cats/tama/weight-records",
    });
  });

  it("同じ位置（再読み込みなど）なら記録をそのまま使う", () => {
    expect(
      nextTrackedEntry(stored, "/cats/tama/weight-records", {
        replaced: false,
        popped: true,
      }),
    ).toBe(stored);
  });

  it("戻る・進むで来た場合は直前のエントリを不明にする", () => {
    expect(
      nextTrackedEntry(stored, "/cats/tama", { replaced: false, popped: true }),
    ).toEqual({ current: "/cats/tama", previous: null });
  });

  it("置き換えなら、置き換え前のエントリの直前を引き継ぐ", () => {
    expect(
      nextTrackedEntry(stored, "/cats/tama/weight-records?page=2", {
        replaced: true,
        popped: false,
      }),
    ).toEqual({
      current: "/cats/tama/weight-records?page=2",
      previous: "/cats/tama",
    });
  });

  it("新しいドキュメントの初回読み込みでは、同じ位置の記録があっても直前のエントリを不明にする", () => {
    expect(
      nextTrackedEntry(stored, "/cats/tama/weight-records", {
        ...push,
        newDocument: true,
      }),
    ).toEqual({ current: "/cats/tama/weight-records", previous: null });
    expect(
      nextTrackedEntry(stored, "/cats/tama/weight-records/new", {
        ...push,
        newDocument: true,
      }),
    ).toEqual({ current: "/cats/tama/weight-records/new", previous: null });
  });

  it("記録がなければ直前のエントリは不明", () => {
    expect(nextTrackedEntry(null, "/cats", push)).toEqual({
      current: "/cats",
      previous: null,
    });
  });

  it("search だけが変わる遷移も別の位置として扱う", () => {
    expect(
      nextTrackedEntry(
        { current: "/cats/tama/expenses", previous: "/cats/tama" },
        "/cats/tama/expenses?month=2026-08",
        push,
      ),
    ).toEqual({
      current: "/cats/tama/expenses?month=2026-08",
      previous: "/cats/tama/expenses",
    });
  });
});

describe("decideSubmitNavigation", () => {
  const entry = {
    current: "/cats/tama/weight-records/new",
    previous: "/cats/tama/weight-records",
  };

  it("直前のエントリが遷移先のページなら戻る", () => {
    expect(
      decideSubmitNavigation(
        entry,
        "/cats/tama/weight-records/new",
        "/cats/tama/weight-records",
      ),
    ).toBe("back");
  });

  it("直前のエントリの search が違っても、同じページなら戻る", () => {
    expect(
      decideSubmitNavigation(
        {
          current: "/cats/tama/expenses/new",
          previous: "/cats/tama/expenses?month=2026-08",
        },
        "/cats/tama/expenses/new",
        "/cats/tama/expenses",
      ),
    ).toBe("back");
  });

  it("直前のエントリが遷移先と違うページなら置き換える", () => {
    expect(
      decideSubmitNavigation(
        { current: "/cats/new", previous: "/cats" },
        "/cats/new",
        "/cats/new-cat-id",
      ),
    ).toBe("replace");
  });

  it("直前のエントリが分からなければ置き換える", () => {
    expect(
      decideSubmitNavigation(
        { current: "/cats/tama/weight-records/new", previous: null },
        "/cats/tama/weight-records/new",
        "/cats/tama/weight-records",
      ),
    ).toBe("replace");
    expect(
      decideSubmitNavigation(
        null,
        "/cats/tama/weight-records/new",
        "/cats/tama/weight-records",
      ),
    ).toBe("replace");
  });

  it("追跡状態が今の位置のものでなければ置き換える", () => {
    expect(
      decideSubmitNavigation(
        entry,
        "/cats/tama/weight-records/abc/edit",
        "/cats/tama/weight-records",
      ),
    ).toBe("replace");
  });

  it("遷移先が今のページなら置き換える", () => {
    expect(
      decideSubmitNavigation(
        {
          current: "/cats/tama/notification-settings",
          previous: "/cats/tama/notification-settings",
        },
        "/cats/tama/notification-settings",
        "/cats/tama/notification-settings",
      ),
    ).toBe("replace");
  });
});

describe("sessionStorage への保存", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("追跡状態を保存して読み出せる", () => {
    expect(readTrackedEntry()).toBeNull();
    writeTrackedEntry({ current: "/cats", previous: null });
    expect(readTrackedEntry()).toEqual({ current: "/cats", previous: null });
  });

  it("予約した遷移を保存・削除できる", () => {
    writePendingNavigation({ type: "back", href: "/cats" });
    expect(readPendingNavigation()).toEqual({ type: "back", href: "/cats" });
    writePendingNavigation(null);
    expect(readPendingNavigation()).toBeNull();
  });

  it("壊れた値は無視する", () => {
    window.sessionStorage.setItem("canshi:navigation:entry", "{");
    expect(readTrackedEntry()).toBeNull();
  });
});
