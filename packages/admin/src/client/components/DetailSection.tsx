import { Heading } from "@canshi/shared/ui";
import type { ReactNode } from "react";
import styles from "./DetailSection.module.css";

/** 詳細ページの、見出しと中身（表など）のまとまり */
export function DetailSection(props: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <Heading level={3}>{props.title}</Heading>
      {props.children}
    </section>
  );
}

/** 詳細ページの基本の項目。子に `dt`・`dd` を交互に並べる */
export function DetailFacts(props: { children: ReactNode }) {
  return <dl className={styles.facts}>{props.children}</dl>;
}
