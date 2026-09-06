"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CatEarFrame,
  FormField,
  Modal,
} from "@/components/ui";
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
        <h2>Button</h2>
        <div className={styles.row}>
          <Button variant="primary">primary</Button>
          <Button variant="secondary">secondary</Button>
          <Button variant="danger">danger</Button>
          <Button variant="primary" disabled>
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
        <h2>Modal</h2>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          モーダルを開く
        </Button>
        <Modal
          open={modalOpen}
          title="確認"
          onClose={() => setModalOpen(false)}
        >
          <p>この記録を削除しますか？</p>
          <div className={styles.row}>
            <Button variant="danger" onClick={() => setModalOpen(false)}>
              削除する
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              キャンセル
            </Button>
          </div>
        </Modal>
      </section>
    </main>
  );
}
