/**
 * クリックがアプリ内の別のページへ移るリンクのものか（進み具合のバーを出すか）。
 * 新しいタブ・ウィンドウで開く操作、ダウンロード、別のオリジン、
 * 今と同じページ（pathname と search が同じで、ハッシュだけが違うものを含む）へのリンクでは出さない。
 * 遷移を取りやめたクリック（`preventDefault` 済み）でも出さない
 * @param currentHref 今の位置の URL（`window.location.href`）
 */
export function isPageLinkClick(event: MouseEvent, currentHref: string) {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  if (!(event.target instanceof Element)) {
    return false;
  }
  const anchor = event.target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return false;
  }
  if (anchor.hasAttribute("download")) {
    return false;
  }
  const target = anchor.getAttribute("target");
  if (target !== null && target !== "" && target !== "_self") {
    return false;
  }

  const href = anchor.getAttribute("href") ?? "";
  const to = new URL(href, currentHref);
  const from = new URL(currentHref);
  if (to.origin !== from.origin) {
    return false;
  }
  return to.pathname !== from.pathname || to.search !== from.search;
}
