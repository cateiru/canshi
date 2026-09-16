"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  Disclosure as AriaDisclosure,
  Button,
  DisclosurePanel,
} from "react-aria-components";
import { Heading } from "../Heading/Heading";
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

  const classes = [styles.disclosure, className].filter(Boolean).join(" ");

  return (
    <AriaDisclosure
      isExpanded={isExpanded}
      onExpandedChange={handleExpandedChange}
      className={classes}
    >
      <Heading level={2} size="md" className={styles.heading}>
        <Button slot="trigger" className={styles.trigger}>
          <span>{title}</span>
          <svg className={styles.arrow} viewBox="0 0 10 6" aria-hidden="true">
            <polyline points="1,1 5,5 9,1" />
          </svg>
        </Button>
      </Heading>
      <DisclosurePanel className={styles.panel}>{children}</DisclosurePanel>
    </AriaDisclosure>
  );
}
