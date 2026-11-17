import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  AccountSettingsIcon,
  CatFaceIcon,
  FeedingIcon,
  HouseholdIcon,
  PoopIcon,
  WeightIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import styles from "./HouseholdRelationDiagram.module.css";

const RECORDS: { label: string; icon: IconType }[] = [
  { label: "ごはん", icon: FeedingIcon },
  { label: "うんち", icon: PoopIcon },
  { label: "体重", icon: WeightIcon },
];

const CAT_NAMES = ["こむぎ", "あずき"];

function TreeNode({
  icon: Icon,
  kind,
  label,
  variant,
}: {
  icon: IconType;
  kind: string;
  label: ReactNode;
  variant?: "household";
}) {
  return (
    <div
      className={[styles.node, variant === "household" && styles.household]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon aria-hidden="true" className={styles.nodeIcon} />
      <span className={styles.kind}>{kind}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}

function RecordsNode() {
  return (
    <div className={`${styles.node} ${styles.records}`}>
      <span className={styles.kind}>記録</span>
      <ul className={styles.recordList}>
        {RECORDS.map(({ label, icon: Icon }) => (
          <li key={label} className={styles.record}>
            <Icon aria-hidden="true" className={styles.recordIcon} />
            {label}
          </li>
        ))}
        <li className={styles.record}>など</li>
      </ul>
    </div>
  );
}

/**
 * 家・ねこ・記録の関係を表す家系図のような図。家の下にメンバーとねこを、ねこの下に記録を線でつなぎ、
 * 「どれがどこに属するか」を見て分かるようにする。読み上げでは入れ子のリストとして読める
 */
export function HouseholdRelationDiagram() {
  return (
    <figure className={styles.figure}>
      <ul className={styles.tree}>
        <li className={styles.root}>
          <TreeNode
            icon={HouseholdIcon}
            kind="家"
            label="わが家"
            variant="household"
          />
          <ul className={styles.children}>
            <li className={styles.branch}>
              <TreeNode icon={AccountSettingsIcon} kind="人" label="オーナー" />
            </li>
            <li className={styles.branch}>
              <TreeNode icon={AccountSettingsIcon} kind="人" label="メンバー" />
            </li>
            {CAT_NAMES.map((name) => (
              <li key={name} className={styles.branch}>
                <TreeNode icon={CatFaceIcon} kind="ねこ" label={name} />
                <ul className={styles.children}>
                  <li className={styles.branch}>
                    <RecordsNode />
                  </li>
                </ul>
              </li>
            ))}
          </ul>
        </li>
      </ul>
      <figcaption className={styles.caption}>
        家にはメンバー（人）とねこが所属し、記録はねこごとにつけます。メンバーは全員、家のねこの記録を見たり追加したりできます。
      </figcaption>
    </figure>
  );
}
