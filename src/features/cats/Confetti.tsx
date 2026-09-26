"use client";

import { type CSSProperties, useEffect, useState } from "react";
import styles from "./Confetti.module.css";

const PIECE_COUNT = 80;
/** 最も遅い紙吹雪が落ちきるまでの時間（delay + duration の最大値）より少し長め */
const LIFETIME_MS = 5000;

const COLORS = [
  "var(--color-accent)",
  "var(--color-accent-cool)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-error)",
  "var(--color-info)",
];

type Piece = {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  rotation: number;
  width: number;
  height: number;
  color: string;
};

function createPieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, index) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 2.6 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 30,
    rotation: 360 + Math.random() * 720,
    width: 6 + Math.random() * 6,
    height: 8 + Math.random() * 8,
    color: COLORS[index % COLORS.length],
  }));
}

function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/**
 * 画面の上から紙吹雪を降らせる演出。数秒で自動的に消える。
 * 操作の邪魔をしないようクリックは透過し、動きを減らす設定の端末では表示しない
 */
export function Confetti() {
  const [pieces, setPieces] = useState<Piece[] | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }
    setPieces(createPieces());
    const timer = window.setTimeout(() => setPieces(null), LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!pieces) {
    return null;
  }

  return (
    <div className={styles.container} aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          // 並びは生成後に変わらないため index をキーにしてよい
          // biome-ignore lint/suspicious/noArrayIndexKey: 固定長の装飾要素
          key={index}
          className={styles.piece}
          style={
            {
              left: `${piece.left}%`,
              width: `${piece.width}px`,
              height: `${piece.height}px`,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              "--confetti-drift": `${piece.drift}vw`,
              "--confetti-rotation": `${piece.rotation}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
