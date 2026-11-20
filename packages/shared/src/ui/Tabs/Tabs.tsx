"use client";

import type { ReactNode } from "react";
import {
  Tabs as AriaTabs,
  type TabsProps as AriaTabsProps,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
} from "react-aria-components";
import styles from "./Tabs.module.css";

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export type TabsProps = Omit<AriaTabsProps, "children"> & {
  items: TabItem[];
};

export function Tabs({ items, className, ...props }: TabsProps) {
  const classes = [styles.tabs, className].filter(Boolean).join(" ");

  return (
    <AriaTabs {...props} className={classes}>
      <TabList items={items} className={styles.list}>
        {(item) => (
          <Tab id={item.id} className={styles.tab}>
            {item.label}
          </Tab>
        )}
      </TabList>
      <TabPanels items={items}>
        {(item) => (
          <TabPanel id={item.id} className={styles.panel}>
            {item.content}
          </TabPanel>
        )}
      </TabPanels>
    </AriaTabs>
  );
}
