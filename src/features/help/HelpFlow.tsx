import Link from "next/link";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import styles from "./HelpFlow.module.css";

export type HelpFlowStep = {
  icon: IconType;
  title: ReactNode;
  description?: ReactNode;
  /** 指定すると、このステップ全体をリンクにする */
  href?: string;
};

type HelpFlowProps = {
  steps: HelpFlowStep[];
  /** ステップに番号を付ける（順に進める手順のとき） */
  numbered?: boolean;
  /** 図が何を表すか。画面の読み上げで使う */
  "aria-label": string;
};

/**
 * 矢印でつないだ流れの図。イラストのアイコンと短い説明を並べ、しくみや手順の全体像を見せる。
 * 広い画面では横に、狭い画面では縦に並べる
 */
export function HelpFlow({
  steps,
  numbered = false,
  "aria-label": ariaLabel,
}: HelpFlowProps) {
  return (
    <ol className={styles.flow} aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const content = (
          <>
            <span className={styles.iconFrame}>
              <Icon className={styles.icon} aria-hidden="true" />
              {numbered ? (
                <span className={styles.number} aria-hidden="true">
                  {index + 1}
                </span>
              ) : null}
            </span>
            <span className={styles.text}>
              <span className={styles.title}>{step.title}</span>
              {step.description ? (
                <span className={styles.description}>{step.description}</span>
              ) : null}
            </span>
          </>
        );

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: ステップは固定の並びで、並べ替えない
          <li key={index} className={styles.step}>
            {step.href ? (
              <Link
                href={step.href}
                className={`${styles.card} ${styles.link}`}
              >
                {content}
              </Link>
            ) : (
              <div className={styles.card}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
