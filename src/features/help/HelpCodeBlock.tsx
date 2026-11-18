"use client";

import { useEffect, useState } from "react";
import { TbCheck, TbCopy } from "react-icons/tb";
import { addToast, IconButton } from "@/components/ui";
import styles from "./HelpCodeBlock.module.css";

/** コピーしたあと、チェックのアイコンを出しておく時間（ミリ秒） */
const COPIED_DURATION_MS = 2000;

type HelpCodeBlockProps = {
  /** 表示し、コピーボタンでコピーする文字列 */
  code: string;
};

/**
 * ヘルプの本文で、そのまま入力してもらう値（URL など）を示すブロック。
 * Docusaurus の CodeBlock のように、右のボタンで中身をコピーできる
 */
export function HelpCodeBlock({ code }: HelpCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_DURATION_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      addToast({
        title: "コピーできませんでした。選択してコピーしてください",
        color: "error",
      });
    }
  };

  return (
    <div className={styles.block}>
      <pre className={styles.pre}>
        <code>{code}</code>
      </pre>
      <IconButton
        icon={copied ? TbCheck : TbCopy}
        aria-label={copied ? "コピーしました" : "コピーする"}
        title={copied ? "コピーしました" : "コピーする"}
        className={styles.copy}
        onPress={handleCopy}
      />
      <span role="status" className={styles.visuallyHidden}>
        {copied ? "コピーしました" : ""}
      </span>
    </div>
  );
}
