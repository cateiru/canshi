"use client";

import Link from "next/link";
import { useId } from "react";
import { TbAdjustments, TbHelpCircle } from "react-icons/tb";
import { SegmentedControl } from "@/components/ui";
import { FEEDING_MODES, type FeedingMode } from "@/db/schema/feeding-modes";
import styles from "./FeedingModeField.module.css";
import { FEEDING_MODE_HELP_HREF, FEEDING_MODE_LABEL } from "./labels";

const FEEDING_MODE_DESCRIPTION: Record<FeedingMode, string> = {
  strict:
    "与えた量・残した量をグラム単位で記録し、食べた量とカロリーを計算します。",
  approximate:
    "与えた量・残した量をおおまかな段階で記録します。グラフやカロリーの計算には含まれません。",
};

type FeedingModeFieldProps = {
  value: FeedingMode;
  onChange: (mode: FeedingMode) => void;
  errorMessage?: string;
};

/**
 * ごはん記録・プリセットのフォームで「厳格モード」「あいまいモード」を選ぶ切り替え。
 * モードは記録（プリセット）単位で選び、すべての商品に同じモードが適用される
 */
export function FeedingModeField({
  value,
  onChange,
  errorMessage,
}: FeedingModeFieldProps) {
  const headingId = useId();
  const descriptionId = useId();

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h2 id={headingId} className={styles.heading}>
          <TbAdjustments aria-hidden="true" size={18} />
          記録方法
        </h2>
        <Link href={FEEDING_MODE_HELP_HREF} className={styles.helpLink}>
          <TbHelpCircle aria-hidden="true" size={16} />
          「厳格モード」「あいまいモード」とは？
        </Link>
      </div>
      {/* SegmentedControl は name を持たないため、選択中のモードを hidden で送る */}
      <input type="hidden" name="mode" value={value} />
      <SegmentedControl
        options={FEEDING_MODES}
        labels={FEEDING_MODE_LABEL}
        value={value}
        onChange={onChange}
        aria-label="記録方法"
        aria-describedby={descriptionId}
      />
      <p id={descriptionId} className={styles.description}>
        {FEEDING_MODE_DESCRIPTION[value]}
      </p>
      {errorMessage ? (
        <p className={styles.errorMessage}>{errorMessage}</p>
      ) : null}
    </section>
  );
}
