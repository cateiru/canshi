import {
  AccountSettingsIcon,
  CatFaceIcon,
  FeedingIcon,
  HouseholdIcon,
  PoopIcon,
  WeightIcon,
} from "@canshi/shared/ui/RecordIcons";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import styles from "./HouseholdRelationDiagram.module.css";

const RECORDS: { label: string; icon: IconType }[] = [
  { label: "ごはん", icon: FeedingIcon },
  { label: "うんち", icon: PoopIcon },
  { label: "体重", icon: WeightIcon },
];

const MEMBER_ROLES = ["オーナー", "メンバー"];

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
 * 家・ねこ・記録の関係を表す家系図のような図。家を真ん中に置き、上にメンバー（人）を、下にねこを、
 * ねこの下に記録を線でつなぎ、人とねこの立場の違いと「どれがどこに属するか」を見て分かるようにする
 */
export function HouseholdRelationDiagram() {
  return (
    <figure className={styles.figure}>
      <div className={styles.tree}>
        <ul className={styles.parents} aria-label="メンバー">
          {MEMBER_ROLES.map((role) => (
            <li key={role} className={styles.parent}>
              <TreeNode icon={AccountSettingsIcon} kind="人" label={role} />
            </li>
          ))}
        </ul>
        <TreeNode
          icon={HouseholdIcon}
          kind="家"
          label="わが家"
          variant="household"
        />
        <ul className={styles.children} aria-label="ねこ">
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
      </div>
      <figcaption className={styles.caption}>
        家を真ん中に、上が家のメンバー（人）、下が家のねこです。記録はねこごとにつけ、メンバーは全員、家のねこの記録を見たり追加したりできます。
      </figcaption>
    </figure>
  );
}
