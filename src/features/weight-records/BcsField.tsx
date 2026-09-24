"use client";

import { useState } from "react";
import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  Label,
} from "react-aria-components";
import { Collapsible } from "@/components/ui";
import styles from "./BcsField.module.css";
import {
  type BcsGuideIllustrationKey,
  getBcsGuideIllustrationSrc,
  getBcsIllustrationSrc,
} from "./bcsIllustrations";
import {
  BCS_DESCRIPTION,
  BCS_LABEL,
  BCS_VALUES,
  type BodyConditionScore,
  isBodyConditionScore,
} from "./labels";

// RadioGroup の値は文字列のため、「未設定」を表す値を別に用意する
const UNSET_VALUE = "unset";

const GUIDE_STEPS: {
  key: BcsGuideIllustrationKey;
  title: string;
  alt: string;
  body: string;
}[] = [
  {
    key: "ribs",
    title: "1. 肋骨を触る",
    alt: "猫の背中から脇腹を手のひらで撫でて肋骨を確かめる様子",
    body: "背中から脇腹にかけて、手のひらで軽く撫でます。理想体重（BCS 3）では肋骨は触れますが、見ることはできません。外から見えるほど浮き出ていれば痩せ、脂肪におおわれて触りにくいほど肥満寄りです。",
  },
  {
    key: "top",
    title: "2. 上から見る",
    alt: "猫を真上から見て、肋骨の後ろにある腰のくびれを確かめる様子",
    body: "真上から見て、肋骨の後ろに腰のくびれがあるかを確かめます。BCS 3 ではくびれがわずかに見られます。くびれが深いほど痩せ、ほとんど見られないほど肥満寄りです。",
  },
  {
    key: "side",
    title: "3. 横から見る",
    alt: "猫を真横から見て、お腹が後ろ足に向かって吊り上がっているかを確かめる様子",
    body: "真横から見て、お腹が後ろ足に向かって吊り上がっているかを確かめます。吊り上がりが丸くなるほど肥満寄りです。なお、脇腹のひだ（たるんだ皮膚）は理想体重の猫にもあるため、ひだがあるだけで肥満とは限りません。歩くと盛んに揺れるほど脂肪が付いていれば肥満の目安です。",
  },
];

type BcsFieldProps = {
  defaultValue?: number | null;
  errorMessage?: string;
};

export function BcsField({ defaultValue, errorMessage }: BcsFieldProps) {
  const [value, setValue] = useState<string>(
    isBodyConditionScore(defaultValue) ? String(defaultValue) : UNSET_VALUE,
  );
  const selected = Number(value);

  return (
    <div className={styles.field}>
      {/* RadioGroup 自体には name を付けず、「未設定」を空文字として送る */}
      <input
        type="hidden"
        name="bcs"
        value={value === UNSET_VALUE ? "" : value}
      />

      <AriaRadioGroup
        value={value}
        onChange={setValue}
        isInvalid={errorMessage != null}
        className={styles.group}
      >
        <Label className={styles.label}>
          BCS（ボディコンディションスコア）
        </Label>
        <p className={styles.hint}>
          体型を5段階で評価します。3が理想体重です。見方は下の「BCSの見方」を参考にしてください。
        </p>

        <div className={styles.options}>
          <AriaRadio value={UNSET_VALUE} className={styles.option}>
            <span className={styles.unset}>未設定</span>
          </AriaRadio>
          {BCS_VALUES.map((bcs) => (
            <AriaRadio
              key={bcs}
              value={String(bcs)}
              className={styles.option}
              aria-label={`BCS ${bcs} ${BCS_LABEL[bcs]}`}
            >
              <img
                src={getBcsIllustrationSrc(bcs)}
                alt=""
                className={styles.illustration}
                width={210}
                height={210}
              />
              <span className={styles.score}>BCS {bcs}</span>
              <span className={styles.scoreLabel}>{BCS_LABEL[bcs]}</span>
            </AriaRadio>
          ))}
        </div>
      </AriaRadioGroup>

      {/* 選択に応じて読み上げられるよう、aria-live の要素は常に描画しておく */}
      <div aria-live="polite">
        {isBodyConditionScore(selected) ? (
          <SelectedDescription bcs={selected} />
        ) : null}
      </div>

      {errorMessage ? (
        <span className={styles.errorMessage}>{errorMessage}</span>
      ) : null}

      <Collapsible
        title="BCSの見方"
        storageKey="weight-record-bcs-guide-expanded"
        defaultExpanded={false}
        className={styles.guide}
      >
        <ol className={styles.guideSteps}>
          {GUIDE_STEPS.map((step) => (
            <li key={step.key} className={styles.guideStep}>
              <img
                src={getBcsGuideIllustrationSrc(step.key)}
                alt={step.alt}
                className={styles.guideIllustration}
                width={210}
                height={128}
              />
              <div>
                <h3 className={styles.guideTitle}>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <dl className={styles.guideTable}>
          {BCS_VALUES.map((bcs) => (
            <div key={bcs}>
              <dt>
                BCS {bcs}（{BCS_LABEL[bcs]}）
              </dt>
              <dd>{BCS_DESCRIPTION[bcs]}</dd>
            </div>
          ))}
        </dl>

        <p className={styles.guideNote}>
          出典:{" "}
          <a
            href="https://www.env.go.jp/nature/dobutsu/aigo/2_data/pamph/petfood_guide_1808/pdf/full.pdf"
            target="_blank"
            rel="noreferrer"
            className={styles.guideNoteLink}
          >
            環境省「飼い主のためのペットフード・ガイドライン」（PDF）
          </a>
          。判断に迷うときや、体重の増減が気になるときは獣医師に相談しましょう。
        </p>
      </Collapsible>
    </div>
  );
}

function SelectedDescription({ bcs }: { bcs: BodyConditionScore }) {
  return (
    <p className={styles.selectedDescription}>
      <strong>
        BCS {bcs}（{BCS_LABEL[bcs]}）
      </strong>
      {BCS_DESCRIPTION[bcs]}
    </p>
  );
}
