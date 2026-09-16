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
  storageKey: string;
  defaultExpanded?: boolean;
  className?: string;
  children: ReactNode;
};

export function Collapsible({
  title,
  storageKey,
  defaultExpanded = true,
  className,
  children,
}: CollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
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
      <Heading level={2} className={styles.heading}>
        <Button slot="trigger" className={styles.trigger}>
          <TbTriangleFilled
            aria-hidden="true"
            size={12}
            className={styles.caret}
          />
          <span className={styles.title}>{title}</span>
        </Button>
      </Heading>
      <DisclosurePanel>
        <div className={styles.panelInner}>{children}</div>
      </DisclosurePanel>
    </AriaDisclosure>
  );
}
