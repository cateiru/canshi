import styles from "./TimelineEntryListSkeleton.module.css";

const PLACEHOLDER_COUNT = 3;

/**
 * タイムラインの記録を読み込んでいるあいだに、記録の一覧の代わりに表示するスケルトン。
 * 記録のカード（TimelineEntryCard）と同じ並びの枠を描き、読み込み中であることを示す
 */
export function TimelineEntryListSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-busy="true">
      <span className={styles.srOnly}>記録を読み込んでいます</span>
      <ul className={styles.list} aria-hidden="true">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 値を持たない枠で、順序も変わらない
          <li key={index} className={styles.row}>
            <div className={styles.rail}>
              <span
                className={styles.railLine}
                data-hidden={index === 0 ? "true" : undefined}
              />
              <span className={styles.dot} />
              <span
                className={styles.railLine}
                data-hidden={
                  index === PLACEHOLDER_COUNT - 1 ? "true" : undefined
                }
              />
            </div>
            <div className={styles.card}>
              <div className={styles.header}>
                <span className={`${styles.bone} ${styles.badge}`} />
                <span className={`${styles.bone} ${styles.time}`} />
              </div>
              <span className={`${styles.bone} ${styles.line}`} />
              <span className={`${styles.bone} ${styles.lineShort}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
