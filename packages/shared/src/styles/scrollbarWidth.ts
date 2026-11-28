/**
 * スクロールバーの幅を測り、`<html>` の CSS 変数 `--scrollbar-width` に入れる。
 *
 * `<html>` の `scrollbar-gutter: stable` でスクロールバーの分の幅を右に空けると、中身はその残りの
 * 幅で中央に置かれ、画面全体が左に寄って見える。メインアプリ・管理画面は、ページの中身・ダイアログの
 * 背景などをこの幅だけ右へ広げ、スクロールバーを右の余白の中に収める（`tokens.css` の
 * `--scrollbar-overlap`）。
 *
 * スクロールバーが中身に重なる環境（スマートフォン・macOS の既定）では 0px になる。ズームで
 * スクロールバーの幅（CSS の px）が変わるため、画面の大きさが変わるたびに測り直す。
 *
 * メインアプリでは、最初の描画の前に測るため、{@link watchScrollbarWidthScript} を `<head>` の
 * `<script>` に書く。そのため、この関数は外側の変数・import を使わず、これだけで動くように書く
 */
export function watchScrollbarWidth(): void {
  const root = document.documentElement;
  const measure = () => {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;top:0;left:0;width:100px;height:100px;overflow:scroll;visibility:hidden;pointer-events:none";
    root.appendChild(probe);
    const width = `${probe.offsetWidth - probe.clientWidth}px`;
    probe.remove();
    if (root.style.getPropertyValue("--scrollbar-width") !== width) {
      root.style.setProperty("--scrollbar-width", width);
    }
  };
  measure();
  window.addEventListener("resize", measure);
}

/** {@link watchScrollbarWidth} を実行する `<script>` の中身 */
export const watchScrollbarWidthScript = `(${watchScrollbarWidth.toString()})();`;
