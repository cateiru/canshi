"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  Disclosure as AriaDisclosure,
  Button,
  DisclosurePanel,
  Heading,
} from "react-aria-components";
import { TbTriangleFilled } from "react-icons/tb";
import styles from "./Collapsible.module.css";

export type CollapsibleProps = {
  title: string;
  /**
   * 開閉状態を localStorage に保存するときのキー。
   * 省略すると保存せず、ページを開くたびに defaultExpanded の状態で表示する
   */
  storageKey?: string;
  defaultExpanded?: boolean;
  /** 見出しの階層。ページ内の位置に合わせて指定する */
  headingLevel?: 2 | 3 | 4;
  /** 見出しの横に添える補足（件数・状態など）。押せる要素は入れない */
  titleAside?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** 見出しを押して開閉できるまとまり */
export function Collapsible({
  title,
  storageKey,
  defaultExpanded = true,
  headingLevel = 2,
  titleAside,
  className,
  children,
}: CollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null) {
        setIsExpanded(stored === "true");
      }
    } catch {
      // localStorage が使えない環境ではデフォルト値のまま表示する
    }
  }, [storageKey]);

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
    >
      <Heading level={headingLevel} className={styles.heading}>
        <Button slot="trigger" className={styles.trigger}>
          <TbTriangleFilled
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
      <DisclosurePanel>
        <div className={styles.panelInner}>{children}</div>
      </DisclosurePanel>
    </AriaDisclosure>
  );
}
