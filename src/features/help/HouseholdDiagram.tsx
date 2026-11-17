import type { IconType } from "react-icons";
import {
  AccountSettingsIcon,
  CatFaceIcon,
  ExpenseIcon,
  FeedingIcon,
  FeedingPresetIcon,
  FeedingScheduleIcon,
  FoodProductIcon,
  HouseholdIcon,
  PoopIcon,
  WeightIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import styles from "./HouseholdDiagram.module.css";

const MEMBERS = [
  { name: "あなた", role: "オーナー" },
  { name: "家族", role: "メンバー" },
];

const CATS = ["ねこ 1", "ねこ 2"];

const RECORD_ICONS: { icon: IconType; label: string }[] = [
  { icon: FeedingIcon, label: "ごはん" },
  { icon: PoopIcon, label: "うんち" },
  { icon: WeightIcon, label: "体重" },
];

const SHARED_ITEMS: { icon: IconType; label: string }[] = [
  { icon: FoodProductIcon, label: "ごはん商品" },
  { icon: FeedingPresetIcon, label: "ごはんプリセット" },
  { icon: FeedingScheduleIcon, label: "ごはんの時間" },
  { icon: ExpenseIcon, label: "支出記録" },
];

/**
 * 家・メンバー・ねこ・記録の関係の図。家の枠の中に、家のメンバー、ねこ（ねこごとの記録）、
 * 家で共有するものを並べる。内容は本文でも説明するため、図全体を 1 枚の画像として読み上げる
 */
export function HouseholdDiagram() {
  return (
    <figure className={styles.figure}>
      <div
        className={styles.house}
        role="img"
        aria-label="家の図。1つの家の中に、オーナーとメンバー、ねこが入っている。記録はねこごとにつけ、ごはん商品・ごはんプリセット・ごはんの時間・支出記録は家で共有する"
      >
        <p className={styles.houseName}>
          <HouseholdIcon className={styles.houseIcon} aria-hidden="true" />家
        </p>

        <div className={styles.group}>
          <p className={styles.groupLabel}>家のメンバー</p>
          <ul className={styles.row}>
            {MEMBERS.map((member) => (
              <li key={member.name} className={styles.member}>
                <AccountSettingsIcon className={styles.memberIcon} />
                <span className={styles.memberName}>{member.name}</span>
                <span className={styles.role}>{member.role}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className={styles.connector}>みんなで記録を見る・つける</p>

        <div className={styles.group}>
          <p className={styles.groupLabel}>ねこ（記録はねこごと）</p>
          <ul className={styles.row}>
            {CATS.map((cat) => (
              <li key={cat} className={styles.cat}>
                <CatFaceIcon className={styles.catIcon} />
                <span className={styles.memberName}>{cat}</span>
                <span className={styles.records}>
                  {RECORD_ICONS.map(({ icon: Icon, label }) => (
                    <Icon key={label} className={styles.recordIcon} />
                  ))}
                  <span>など</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.group}>
          <p className={styles.groupLabel}>家で共有するもの</p>
          <ul className={styles.shared}>
            {SHARED_ITEMS.map(({ icon: Icon, label }) => (
              <li key={label} className={styles.sharedItem}>
                <Icon className={styles.sharedIcon} />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className={styles.caption}>
        家・メンバー・ねこ・記録の関係
      </figcaption>
    </figure>
  );
}
