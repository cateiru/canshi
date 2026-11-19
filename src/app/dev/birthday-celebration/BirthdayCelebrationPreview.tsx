"use client";

import { useState } from "react";
import { Button, FormField } from "@/components/ui";
import {
  type BirthdayMilestone,
  formatMilestoneAge,
} from "@/features/cats/domain/birthday";
import { BirthdayCelebrationModal } from "@/features/cats/presentation/BirthdayCelebration";
import styles from "./page.module.css";

/** 1歳未満は生後1〜11ヶ月の毎月の記念日 */
const MONTHLY_MILESTONES: BirthdayMilestone[] = Array.from(
  { length: 11 },
  (_, index) => ({ kind: "monthly", months: index + 1 }),
);

/** ライフステージの区切り（6歳・10歳）をまたいで、シニア期まで確かめられる範囲 */
const YEARLY_MILESTONES: BirthdayMilestone[] = Array.from(
  { length: 20 },
  (_, index) => ({ kind: "yearly", years: index + 1 }),
);

export function BirthdayCelebrationPreview() {
  const [name, setName] = useState("たま");
  const [profileMediaAssetId, setProfileMediaAssetId] = useState("");
  const [opened, setOpened] = useState<{
    milestone: BirthdayMilestone;
    // 同じ節目を続けて開いたときも紙吹雪を最初から降らせるため、開くたびに変える
    key: number;
  } | null>(null);

  const open = (milestone: BirthdayMilestone) =>
    setOpened((prev) => ({ milestone, key: (prev?.key ?? 0) + 1 }));

  const renderButtons = (milestones: BirthdayMilestone[]) => (
    <div className={styles.buttons}>
      {milestones.map((milestone) => {
        const age = formatMilestoneAge(milestone);
        return (
          <Button key={age} onPress={() => open(milestone)}>
            {age}
          </Button>
        );
      })}
    </div>
  );

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>誕生日のお祝いの確認</h1>
      <p className={styles.description}>
        節目を選ぶと、その日のお祝いの紙吹雪とモーダルを表示します。日付やこの端末でのお祝い済みの記録に関わらず、何度でも開けます。
      </p>

      <section className={styles.section}>
        <h2 className={styles.heading}>猫</h2>
        <FormField label="名前" value={name} onChange={setName} />
        <FormField
          label="プロフィール画像の media asset ID（任意）"
          description="空欄なら、写真のない猫のアイコンを表示します。"
          value={profileMediaAssetId}
          onChange={setProfileMediaAssetId}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>毎月の記念日（1歳未満）</h2>
        {renderButtons(MONTHLY_MILESTONES)}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>誕生日（1歳以上）</h2>
        {renderButtons(YEARLY_MILESTONES)}
      </section>

      {opened ? (
        <BirthdayCelebrationModal
          key={opened.key}
          cat={{
            name: name.trim() || "たま",
            profileMediaAssetId: profileMediaAssetId.trim() || null,
          }}
          milestone={opened.milestone}
          onClose={() => setOpened(null)}
        />
      ) : null}
    </main>
  );
}
