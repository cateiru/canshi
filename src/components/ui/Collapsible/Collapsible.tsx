"use client";

import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";
import {
  Disclosure as AriaDisclosure,
  Button,
  DisclosurePanel,
  Heading,
} from "react-aria-components";
import { TbTriangleFilled } from "react-icons/tb";
import { ScaledIcon } from "@/components/ui/ScaledIcon/ScaledIcon";
import styles from "./Collapsible.module.css";

export type CollapsibleProps = {
  title: string;
  /**
   * 開閉状態を localStorage に保存するときのキー。
   * 省略すると保存せず、ページを開くたびに defaultExpanded の状態で表示する
   */
  storageKey?: string;
  defaultExpanded?: boolean;
  /**
   * storageKey の開閉状態を読むまで、開いた高さの空白にしておく。
   * 保存した状態はブラウザでしか読めないため、サーバーでは開いた状態を見えないように描き、
   * 開いたまま保存した人が読み込み後に下の内容を押し下げられないようにする
   */
  reserveExpandedSpace?: boolean;
  /** 見出しの階層。ページ内の位置に合わせて指定する */
  headingLevel?: 2 | 3 | 4;
  /** 見出しの横に添える補足（件数・状態など）。押せる要素は入れない */
  titleAside?: ReactNode;
  /**
   * 見出しの右端に置く操作（設定ページへのリンクなど）。
   * 開閉ボタンの外に描画するため、押しても開閉しない
   */
  headerActions?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** 見出しを押して開閉できるまとまり */
export function Collapsible({
  title,
  storageKey,
  defaultExpanded = true,
  reserveExpandedSpace = false,
  headingLevel = 2,
  titleAside,
  headerActions,
  className,
  children,
}: CollapsibleProps) {
  const isReserving = Boolean(storageKey) && reserveExpandedSpace;
  const [isExpanded, setIsExpanded] = useState(
    isReserving ? true : defaultExpanded,
  );
  const [isRestoring, setIsRestoring] = useState(isReserving);

  useEffect(() => {
    if (!storageKey || isReserving) {
      return;
    }
    const stored = readStoredExpanded(storageKey);
    if (stored !== null) {
      setIsExpanded(stored);
    }
  }, [storageKey, isReserving]);

  // 空白にしている間は、描画前に保存した状態へ切り替える。見えるようにするのは次のフレームにし、
  // 開いた状態から閉じた状態へ切り替えたときの矢印の回転が見えないようにする
  useLayoutEffect(() => {
    if (!storageKey || !isReserving) {
      return;
    }
    setIsExpanded(readStoredExpanded(storageKey) ?? defaultExpanded);
    const frame = window.requestAnimationFrame(() => setIsRestoring(false));
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey, isReserving, defaultExpanded]);

  const handleExpandedChange = (expanded: boolean) => {
    setIsExpanded(expanded);
    if (!storageKey) {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, String(expanded));
    } catch {
      // localStorage が使えない環境では状態を保持できないが、表示自体は継続する
    }
  };

  const classes = [styles.container, className].filter(Boolean).join(" ");

  return (
    <AriaDisclosure
      isExpanded={isExpanded}
      onExpandedChange={handleExpandedChange}
      className={classes}
      data-restoring={isRestoring || undefined}
    >
      <div className={styles.header}>
        <Heading level={headingLevel} className={styles.heading}>
          <Button slot="trigger" className={styles.trigger}>
            <ScaledIcon
              icon={TbTriangleFilled}
              aria-hidden="true"
              size={12}
              className={styles.caret}
            />
            <span className={styles.title}>{title}</span>
            {titleAside ? (
              <span className={styles.titleAside}>{titleAside}</span>
            ) : null}
          </Button>
        </Heading>
        {headerActions ? (
          <div className={styles.headerActions}>{headerActions}</div>
        ) : null}
      </div>
      <DisclosurePanel>
        <div className={styles.panelInner}>{children}</div>
      </DisclosurePanel>
    </AriaDisclosure>
  );
}

/** 保存した開閉状態。保存がない、または localStorage が使えないときは null */
function readStoredExpanded(storageKey: string): boolean | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === null ? null : stored === "true";
  } catch {
    // localStorage が使えない環境ではデフォルト値のまま表示する
    return null;
  }
}
