import type { ReactNode } from "react";
import { HelpScreenshot } from "./HelpScreenshot";
import styles from "./HelpSteps.module.css";
import type { HelpScreenshotName } from "./screenshots";

export type HelpStep = {
  title: ReactNode;
  body?: ReactNode;
  screenshot?: { name: HelpScreenshotName; alt: string };
};

type HelpStepsProps = {
  steps: HelpStep[];
};

/** 操作の手順。番号付きで並べ、手順ごとに画面のスクリーンショットを添えられる */
export function HelpSteps({ steps }: HelpStepsProps) {
  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 手順は固定の並びで、並べ替えない
        <li key={index} className={styles.step}>
          <div className={styles.text}>
            <p className={styles.title}>
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span>{step.title}</span>
            </p>
            {step.body ? <div className={styles.body}>{step.body}</div> : null}
          </div>
          {step.screenshot ? (
            <HelpScreenshot
              name={step.screenshot.name}
              alt={step.screenshot.alt}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
