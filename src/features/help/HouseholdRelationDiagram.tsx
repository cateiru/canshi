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
import styles from "./HouseholdRelationDiagram.module.css";

type DiagramItem = { label: string; icon: IconType };

const MEMBERS: DiagramItem[] = [
  { label: "オーナー", icon: AccountSettingsIcon },
  { label: "メンバー", icon: AccountSettingsIcon },
];

const SHARED_ITEMS: DiagramItem[] = [
  { label: "ごはん商品", icon: FoodProductIcon },
  { label: "ごはんプリセット", icon: FeedingPresetIcon },
  { label: "ごはんの時間", icon: FeedingScheduleIcon },
  { label: "支出記録", icon: ExpenseIcon },
];

const RECORDS: DiagramItem[] = [
  { label: "ごはん", icon: FeedingIcon },
  { label: "うんち", icon: PoopIcon },
  { label: "体重", icon: WeightIcon },
];

const CAT_NAMES = ["こむぎ", "あずき"];

function ItemList({ items }: { items: DiagramItem[] }) {
  return (
    <ul className={styles.items}>
      {items.map(({ label, icon: Icon }) => (
        <li key={label} className={styles.item}>
          <Icon aria-hidden="true" className={styles.itemIcon} />
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * 家・ねこ・記録の関係を表す図。家の枠の中にメンバー・家ごとに共有するもの・ねこを、
 * ねこの枠の中に記録を入れ子で描き、「どれがどこに属するか」を見て分かるようにする
 */
export function HouseholdRelationDiagram() {
  return (
    <figure className={styles.figure}>
      <div className={styles.household}>
        <p className={styles.boxTitle}>
          <HouseholdIcon aria-hidden="true" className={styles.titleIcon} />
          <span>
            家<span className={styles.example}>（例：わが家）</span>
          </span>
        </p>

        <div className={styles.group}>
          <p className={styles.groupTitle}>メンバー</p>
          <ItemList items={MEMBERS} />
        </div>

        <div className={styles.group}>
          <p className={styles.groupTitle}>家のメンバー全員で使うもの</p>
          <ItemList items={SHARED_ITEMS} />
        </div>

        <div className={styles.group}>
          <p className={styles.groupTitle}>ねこ</p>
          <ul className={styles.cats}>
            {CAT_NAMES.map((name) => (
              <li key={name} className={styles.cat}>
                <p className={styles.boxTitle}>
                  <CatFaceIcon
                    aria-hidden="true"
                    className={styles.titleIcon}
                  />
                  <span>{name}</span>
                </p>
                <div className={styles.group}>
                  <p className={styles.groupTitle}>記録</p>
                  <ItemList items={RECORDS} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className={styles.caption}>
        家の中にメンバーとねこがいて、記録はねこごとにつけます。メンバーは全員、家のねこの記録を見たり追加したりできます。
      </figcaption>
    </figure>
  );
}
