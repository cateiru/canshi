"use client";

import { useEffect, useState } from "react";
import { TbCake } from "react-icons/tb";
import { Button, Modal } from "@/components/ui";
import styles from "./BirthdayCelebration.module.css";
import {
  type BirthdayCelebrationCat,
  type BirthdayMilestone,
  birthdayCelebratedStorageKey,
  formatMilestoneAge,
  getBirthdayMilestone,
  getLifeStageMessage,
  toHumanAge,
  toLocalCalendarDate,
} from "./birthday";
import { CatAvatar } from "./CatAvatar";
import { Confetti } from "./Confetti";

type Celebration = {
  cat: BirthdayCelebrationCat;
  milestone: BirthdayMilestone;
  storageKey: string;
};

/**
 * localStorage が使えない環境では「お祝い済み」とみなす。
 * 記録を残せないとページを開くたびに表示されてしまうため、端末ごとに1度という約束を優先する
 */
function hasCelebrated(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) !== null;
  } catch {
    return true;
  }
}

function markCelebrated(storageKey: string): void {
  try {
    window.localStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // 記録できなくても表示中のお祝いはそのまま続ける
  }
}

/**
 * 猫の誕生日（1歳未満は毎月の記念日）にページを開くと、紙吹雪とお祝いのモーダルを表示する。
 * 節目かどうかは端末のローカル日付で判定し、猫・節目ごとに端末で1度だけ表示する。
 * 同じ日にお祝いする猫が複数いる場合は、閉じるたびに次の猫のお祝いを表示する
 */
export function BirthdayCelebration({
  cats,
}: {
  cats: BirthdayCelebrationCat[];
}) {
  const [queue, setQueue] = useState<Celebration[]>([]);

  // 端末のローカル日付と localStorage はサーバーでは分からないため、マウント後に判定する
  useEffect(() => {
    const today = toLocalCalendarDate(new Date());
    const pending = cats.flatMap((cat) => {
      if (!cat.birthDate) {
        return [];
      }
      const milestone = getBirthdayMilestone(cat.birthDate, today);
      if (milestone === null) {
        return [];
      }
      const storageKey = birthdayCelebratedStorageKey(cat.id, milestone);
      return hasCelebrated(storageKey) ? [] : [{ cat, milestone, storageKey }];
    });
    setQueue(pending);
  }, [cats]);

  const current = queue[0];

  // 表示した時点でお祝い済みにする（閉じずに離脱しても、次に開いたときに再表示しない）
  useEffect(() => {
    if (current) {
      markCelebrated(current.storageKey);
    }
  }, [current]);

  if (!current) {
    return null;
  }

  const { cat, milestone } = current;
  const age = formatMilestoneAge(milestone);
  const close = () => setQueue((prev) => prev.slice(1));

  return (
    <>
      <Confetti key={current.storageKey} />
      <Modal
        open
        onClose={close}
        title={
          <span className={styles.title}>
            <TbCake aria-hidden="true" size={24} />
            {milestone.kind === "yearly"
              ? "お誕生日おめでとう！"
              : `${age}おめでとう！`}
          </span>
        }
      >
        <div className={styles.body}>
          <CatAvatar
            name={cat.name}
            profileMediaAssetId={cat.profileMediaAssetId}
            profileCropX={cat.profileCropX}
            profileCropY={cat.profileCropY}
            profileCropZoom={cat.profileCropZoom}
            profileCropRotation={cat.profileCropRotation}
            size="lg"
          />
          <p className={styles.lead}>
            {milestone.kind === "yearly"
              ? `今日は${cat.name}の${age}の誕生日です。`
              : `今日で${cat.name}は${age}になりました。`}
          </p>
          <div className={styles.trivia}>
            <p>猫の{age}は、人間に換算すると</p>
            <p className={styles.humanAge}>約{toHumanAge(milestone)}歳</p>
            <p>{getLifeStageMessage(milestone)}</p>
            <p className={styles.note}>
              ※ 換算は一般的な目安です。成長の早さには個体差があります。
            </p>
          </div>
          <Button variant="primary" onPress={close} className={styles.close}>
            閉じる
          </Button>
        </div>
      </Modal>
    </>
  );
}
