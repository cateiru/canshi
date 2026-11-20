"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./BurstConfetti.module.css";

const PIECE_COUNT = 140;
/** 紙吹雪を描き続ける時間。最後の 0.8 秒で薄くして消す */
const LIFETIME_MS = 3500;
const FADE_MS = 800;
/** 1 フレーム（60fps）あたりの重力と空気抵抗。値は見た目で決めた */
const GRAVITY = 0.16;
const DRAG = 0.965;
/** ひらひら舞うときの落ちる速さの上限 */
const MAX_FALL_SPEED = 3;

/** 見た目設定のアクセント色などに合わせる。読めなかったときは既定のテーマの色を使う */
const COLOR_TOKENS: [token: string, fallback: string][] = [
  ["--color-accent", "#ec995a"],
  ["--color-accent-cool", "#4fb0d8"],
  ["--color-success", "#52b355"],
  ["--color-warning", "#f2d14b"],
  ["--color-error", "#f25c4b"],
  ["--color-info", "#4f87db"],
];

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  rotation: number;
  rotationSpeed: number;
  /** 紙が裏返る（縦につぶれる）動きの位相と速さ */
  flip: number;
  flipSpeed: number;
  /** 左右に揺れる動きの位相・速さ・幅 */
  sway: number;
  swaySpeed: number;
  swayWidth: number;
  color: string;
  isCircle: boolean;
};

function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/** CSS 変数の色を、canvas で使える色の文字列にする */
function resolveColors(element: HTMLElement): string[] {
  return COLOR_TOKENS.map(([token, fallback]) => {
    const value = getComputedStyle(element).getPropertyValue(token).trim();
    return value || fallback;
  });
}

/** 画面の中心から、四方へ弾けるように飛ぶ紙吹雪を作る。上向きに少し強く飛ばす */
function createPieces(width: number, height: number, colors: string[]) {
  const scale = Math.min(1.4, Math.max(0.7, Math.min(width, height) / 600));
  return Array.from({ length: PIECE_COUNT }, (_, index): Piece => {
    const angle = Math.random() * Math.PI * 2;
    const speed = (5 + Math.random() * 11) * scale;
    return {
      x: width / 2,
      y: height / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4 * scale,
      width: 6 + Math.random() * 6,
      height: 9 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      flip: Math.random() * Math.PI * 2,
      flipSpeed: 0.08 + Math.random() * 0.12,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.03 + Math.random() * 0.04,
      swayWidth: 0.6 + Math.random() * 1.2,
      color: colors[index % colors.length],
      isCircle: Math.random() < 0.25,
    };
  });
}

/** 経過したフレーム数（60fps 換算）だけ、紙吹雪を動かす */
function stepPiece(piece: Piece, frames: number) {
  const drag = DRAG ** frames;
  piece.vx *= drag;
  // 下向きに弾けた勢いは空気抵抗で落とし、そのあとは上限の速さでゆっくり落ちる
  piece.vy =
    piece.vy > MAX_FALL_SPEED
      ? Math.max(MAX_FALL_SPEED, piece.vy * drag)
      : Math.min(MAX_FALL_SPEED, piece.vy * drag + GRAVITY * frames);
  piece.sway += piece.swaySpeed * frames;
  // 勢いが落ちて落ちはじめたら、左右に揺れながら舞うようにする
  const swayStrength = Math.max(0, 1 - Math.abs(piece.vx) / 4);
  piece.x +=
    (piece.vx + Math.sin(piece.sway) * piece.swayWidth * swayStrength) * frames;
  piece.y += piece.vy * frames;
  piece.rotation += piece.rotationSpeed * frames;
  piece.flip += piece.flipSpeed * frames;
}

function drawPiece(context: CanvasRenderingContext2D, piece: Piece) {
  context.save();
  context.translate(piece.x, piece.y);
  context.rotate(piece.rotation);
  // 裏返るように縦につぶす（つぶれきって見えなくならないよう、少し残す）
  context.scale(1, Math.max(0.15, Math.abs(Math.cos(piece.flip))));
  context.fillStyle = piece.color;
  if (piece.isCircle) {
    context.beginPath();
    context.arc(0, 0, piece.width / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillRect(
      -piece.width / 2,
      -piece.height / 2,
      piece.width,
      piece.height,
    );
  }
  context.restore();
}

/**
 * 画面の中心から弾けるように飛び出し、ひらひらと舞い落ちる紙吹雪。数秒で自動的に消える。
 * 操作の邪魔をしないようクリックは透過し、動きを減らす設定の端末では表示しない
 */
export function BurstConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || prefersReducedMotion()) {
      setIsVisible(false);
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.scale(ratio, ratio);

    const pieces = createPieces(width, height, resolveColors(canvas));
    const startedAt = performance.now();
    let lastTime = startedAt;
    let frameId = 0;

    const render = (time: number) => {
      const elapsed = time - startedAt;
      if (elapsed >= LIFETIME_MS) {
        setIsVisible(false);
        return;
      }
      // タブを裏にしていたときなどに一度に大きく動かないよう、進める量に上限を設ける
      const frames = Math.min(3, (time - lastTime) / (1000 / 60));
      lastTime = time;

      context.clearRect(0, 0, width, height);
      context.globalAlpha = Math.min(1, (LIFETIME_MS - elapsed) / FADE_MS);
      for (const piece of pieces) {
        stepPiece(piece, frames);
        if (piece.y - piece.height < height) {
          drawPiece(context, piece);
        }
      }
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, []);

  if (!isVisible) {
    return null;
  }
  // canvas は読み上げの対象から外すため、aria-hidden を付けた要素で包む
  return (
    <div className={styles.container} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
