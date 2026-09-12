"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  addToast,
  Badge,
  Button,
  Card,
  CatEarFrame,
  Checkbox,
  FormField,
  Heading,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Tabs,
  Textarea,
} from "@/components/ui";
import {
  TIMELINE_TYPE_ICON,
  TIMELINE_TYPE_LABEL,
} from "@/features/timeline/labels";
import type { TimelineRecordType } from "@/features/timeline/queries";
import { TimelineCalendar } from "@/features/timeline/TimelineCalendar";
import styles from "./page.module.css";

const COLOR_TOKENS = [
  "--color-bg",
  "--color-ink",
  "--color-accent",
  "--color-success",
  "--color-warning",
  "--color-error",
  "--color-info",
] as const;

const SPACE_TOKENS = [
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-6",
  "--space-8",
] as const;

const TEXT_TOKENS = [
  "--text-xl",
  "--text-lg",
  "--text-md",
  "--text-sm",
  "--text-xs",
] as const;

const BADGE_COLORS = ["info", "success", "warning", "error", "accent"] as const;
const ALERT_COLORS = ["info", "success", "warning", "error"] as const;

const SEX_OPTIONS = [
  { value: "female", label: "メス" },
  { value: "male", label: "オス" },
  { value: "unknown", label: "不明" },
];

const TAB_ITEMS = [
  {
    id: "food",
    label: "ごはん",
    content: <p>2026-09-06 08:00 ドライフード 30g</p>,
  },
  { id: "weight", label: "体重", content: <p>2026-09-06 4.2kg</p> },
  { id: "memo", label: "メモ", content: <p>健康診断は来月の予定。</p> },
];

export default function ComponentsPreviewPage() {
  const [modalOpen, setModalOpen] = useState(false);

  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className={styles.main}>
      <h1>コンポーネントプレビュー</h1>
      <p>開発時のみ表示される、デザインシステムの確認用ページ。</p>

      <section>
        <h2>記録アイコン</h2>
        <div className={styles.recordIcons}>
          {Object.entries(TIMELINE_TYPE_ICON).map(([type, Icon]) => (
            <div key={type} className={styles.recordIconSample}>
              <span>{TIMELINE_TYPE_LABEL[type as TimelineRecordType]}</span>
              <div className={styles.row}>
                <Icon size={32} aria-hidden="true" />
                <Icon size={24} aria-hidden="true" />
                <Icon size={18} aria-hidden="true" />
                <Icon size={14} monochrome aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>タイムラインカレンダー</h2>
        <TimelineCalendar
          catId="preview"
          year={2026}
          month={9}
          ym="2026-09"
          todayKey="2026-09-12"
          selectedDate="2026-09-13"
          prevHref="/dev/components"
          nextHref="/dev/components"
          datesByDay={
            new Map([
              ["2026-09-12", ["feeding", "poop", "weight", "vomit", "water"]],
              ["2026-09-13", ["shampoo", "cleaning", "symptom"]],
              ["2026-09-14", ["medicationDose", "hospitalVisit", "catPhoto"]],
            ])
          }
        />
      </section>

      <section>
        <h2>カラートークン</h2>
        <div className={styles.swatchRow}>
          {COLOR_TOKENS.map((token) => (
            <div key={token} className={styles.swatch}>
              <span
                className={styles.swatchColor}
                style={{ backgroundColor: `var(${token})` }}
              />
              <code>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>タイポグラフィ</h2>
        {TEXT_TOKENS.map((token) => (
          <p key={token} style={{ fontSize: `var(${token})` }}>
            {token} — 愛猫の記録アプリ
          </p>
        ))}
      </section>

      <section>
        <h2>スペーシング</h2>
        <div className={styles.spaceRow}>
          {SPACE_TOKENS.map((token) => (
            <div key={token} className={styles.spaceItem}>
              <div
                className={styles.spaceBox}
                style={{ width: `var(${token})`, height: `var(${token})` }}
              />
              <code>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Heading</h2>
        <div className={styles.formSample}>
          <Heading level={1}>見出し xl（level 1）</Heading>
          <Heading level={2}>見出し lg（level 2）</Heading>
          <Heading level={3}>見出し md（level 3）</Heading>
        </div>
      </section>

      <section>
        <h2>Button</h2>
        <div className={styles.row}>
          <Button variant="primary">primary</Button>
          <Button variant="secondary">secondary</Button>
          <Button variant="danger">danger</Button>
          <Button variant="primary" isDisabled>
            disabled
          </Button>
        </div>
      </section>

      <section>
        <h2>Badge</h2>
        <div className={styles.row}>
          {BADGE_COLORS.map((color) => (
            <Badge key={color} color={color}>
              {color}
            </Badge>
          ))}
        </div>
      </section>

      <section>
        <h2>Alert</h2>
        <div className={styles.formSample}>
          {ALERT_COLORS.map((color) => (
            <Alert key={color} color={color}>
              {color} の Alert です。
            </Alert>
          ))}
        </div>
      </section>

      <section>
        <h2>CatEarFrame</h2>
        <CatEarFrame className={styles.catEarSample}>
          猫耳を模した装飾つきコンテナ
        </CatEarFrame>
      </section>

      <section>
        <h2>Card</h2>
        <Card title="ごはん記録">
          <p>2026-09-06 08:00 ドライフード 30g</p>
        </Card>
      </section>

      <section>
        <h2>FormField</h2>
        <div className={styles.formSample}>
          <FormField label="名前" placeholder="たま" />
          <FormField
            label="メールアドレス"
            placeholder="cat@example.com"
            errorMessage="正しい形式で入力してください"
          />
        </div>
      </section>

      <section>
        <h2>Textarea</h2>
        <div className={styles.formSample}>
          <Textarea
            label="メモ"
            placeholder="気づいたことを記録する"
            rows={4}
          />
          <Textarea label="診察内容" errorMessage="必須です" rows={4} />
        </div>
      </section>

      <section>
        <h2>Select</h2>
        <div className={styles.formSample}>
          <Select
            label="性別"
            options={SEX_OPTIONS}
            placeholder="選択してください"
          />
        </div>
      </section>

      <section>
        <h2>Checkbox</h2>
        <div className={styles.formSample}>
          <Checkbox>ドライフード</Checkbox>
          <Checkbox defaultSelected>ウェットフード</Checkbox>
          <Checkbox isDisabled>おやつ（無効）</Checkbox>
        </div>
      </section>

      <section>
        <h2>Radio</h2>
        <RadioGroup label="性別" defaultValue="unknown">
          <Radio value="female">メス</Radio>
          <Radio value="male">オス</Radio>
          <Radio value="unknown">不明</Radio>
        </RadioGroup>
      </section>

      <section>
        <h2>Tabs</h2>
        <Tabs aria-label="猫の記録" items={TAB_ITEMS} />
      </section>

      <section>
        <h2>Toast</h2>
        <div className={styles.row}>
          <Button
            variant="primary"
            onPress={() =>
              addToast({ title: "保存しました", color: "success" })
            }
          >
            成功トーストを表示
          </Button>
          <Button
            variant="danger"
            onPress={() =>
              addToast({ title: "保存に失敗しました", color: "error" })
            }
          >
            エラートーストを表示
          </Button>
        </div>
      </section>

      <section>
        <h2>Modal</h2>
        <Button variant="primary" onPress={() => setModalOpen(true)}>
          モーダルを開く
        </Button>
        <Modal
          open={modalOpen}
          title="確認"
          onClose={() => setModalOpen(false)}
        >
          <p>この記録を削除しますか？</p>
          <div className={styles.row}>
            <Button variant="danger" onPress={() => setModalOpen(false)}>
              削除する
            </Button>
            <Button variant="secondary" onPress={() => setModalOpen(false)}>
              キャンセル
            </Button>
          </div>
        </Modal>
      </section>
    </main>
  );
}
