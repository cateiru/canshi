import type { ReactNode } from "react";
import { type ErrorCode, ErrorCodeIllustration } from "./ErrorCodeIllustration";
import styles from "./ErrorView.module.css";

type ErrorViewProps = {
  code: ErrorCode;
  title: string;
  description: ReactNode;
  /** 問い合わせのときに伝えてもらうエラーの ID（Next.js の `error.digest`） */
  errorId?: string;
  /** トップページへのリンク・再読み込みのボタンなど */
  actions: ReactNode;
};

/** 404・500 などのエラーページの中身。数字のイラスト・見出し・説明・操作を中央に並べる */
export function ErrorView({
  code,
  title,
  description,
  errorId,
  actions,
}: ErrorViewProps) {
  return (
    <main className={styles.main}>
      <ErrorCodeIllustration code={code} />
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {errorId ? (
          <p className={styles.errorId}>
            エラー ID: <code>{errorId}</code>
          </p>
        ) : null}
      </div>
      <div className={styles.actions}>{actions}</div>
    </main>
  );
}
