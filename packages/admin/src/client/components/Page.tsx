import { Breadcrumb, type BreadcrumbItem, Heading } from "@canshi/shared/ui";
import { type ReactNode, useEffect } from "react";
import { RouterLink } from "../RouterLink";
import styles from "./Page.module.css";

/**
 * ページの見出しと中身。見出しはタブ（`<title>`）にも使う
 */
export function Page(props: {
  title: string;
  /** メインアプリの Breadcrumb と同じく、見出しの上に一覧などへ戻るリンクを並べる */
  breadcrumb?: BreadcrumbItem[];
  /** 見出しの右に置く操作（登録ボタンなど） */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { title } = props;
  useEffect(() => {
    document.title = `${title} | CANSHI 管理画面`;
  }, [title]);

  return (
    <>
      {props.breadcrumb ? (
        <Breadcrumb items={props.breadcrumb} linkComponent={RouterLink} />
      ) : null}
      <div className={styles.header}>
        <Heading level={2} size="xl">
          {title}
        </Heading>
        {props.actions}
      </div>
      {props.children}
    </>
  );
}
