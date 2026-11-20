import type { AnchorHTMLAttributes, ComponentType, Ref } from "react";

/**
 * ページを移動するリンクの props。使う側のルーター（Next.js の `next/link` など）に依存しないよう、
 * `<a>` の属性に、移動の仕方のヒント（`replace`・`transitionTypes`）だけを足した形にする。
 * ヒントに対応しない実装（素の `<a>` など）では無視してよい
 */
export type LinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href: string;
  /** 今の履歴エントリを置き換えて移動する（通過するだけのページへ戻るリンクなど） */
  replace?: boolean;
  /** 移動するときに付ける View Transition の種類（前後の向きに合わせて動かすときなど） */
  transitionTypes?: string[];
  ref?: Ref<HTMLAnchorElement>;
};

/**
 * リンクを描くコンポーネント。リンクを含むコンポーネントは `linkComponent` で受け取り、
 * 使う側がルーターのリンク（Next.js なら `next/link`）を渡す。渡さないときは `AnchorLink`（素の `<a>`）
 */
export type LinkComponent = ComponentType<LinkProps>;

/** 素の `<a>` で描くリンク。`replace`・`transitionTypes` は扱わない */
export function AnchorLink({
  replace: _replace,
  transitionTypes: _transitionTypes,
  ...props
}: LinkProps) {
  return <a {...props} />;
}

/** `linkComponent` を受け取るコンポーネントの props */
export type LinkComponentProps = {
  /** リンクを描くコンポーネント。省略すると素の `<a>`（`AnchorLink`） */
  linkComponent?: LinkComponent;
};
