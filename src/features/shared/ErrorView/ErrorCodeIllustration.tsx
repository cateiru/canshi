import { useId } from "react";
import { DEFAULT_CAT_COAT } from "@/components/ui/RecordIcons/RecordIcons";
import styles from "./ErrorView.module.css";

/** イラストで描ける数字。エラーページで使う 404・500 の数字だけを用意する */
type Digit = "0" | "4" | "5";

export type ErrorCode = "404" | "500";

/** 2 文字目は、猫がのぞく 0 にする */
const CODE_DIGITS: Record<ErrorCode, readonly [Digit, "0", Digit]> = {
  "404": ["4", "0", "4"],
  "500": ["5", "0", "0"],
};

// 数字は 1 文字あたり幅 90・高さ 140（y = 10〜150）の枠に描き、15 ずつ空けて並べる
const DIGIT_WIDTH = 90;
const DIGIT_GAP = 15;
const MARGIN_X = 5;
const ZERO_CENTER_Y = 80;
const ZERO_OUTER = { rx: 45, ry: 70 };
const ZERO_INNER = { rx: 20, ry: 46 };

function digitLeft(index: number) {
  return MARGIN_X + index * (DIGIT_WIDTH + DIGIT_GAP);
}

/** 斜めの線と横棒の「4」。内側の三角形を evenodd でくり抜く */
function fourPath(x: number) {
  return [
    `M${x + 52} 10H${x + 72}V100H${x + 90}V120H${x + 72}V150H${x + 52}V120H${x}V100Z`,
    `M${x + 52} 46V100H${x + 20.8}Z`,
  ].join("");
}

/** 上の横棒・左の縦棒・下の丸い腹からなる「5」 */
function fivePath(x: number) {
  return [
    `M${x + 6} 10H${x + 86}V30H${x + 26}L${x + 24.5} 62`,
    `C${x + 32} 58 ${x + 40} 56 ${x + 48} 56`,
    `C${x + 73} 56 ${x + 90} 75 ${x + 90} 101`,
    `C${x + 90} 129 ${x + 70} 150 ${x + 44} 150`,
    `C${x + 26} 150 ${x + 10} 142 ${x + 2} 128`,
    `L${x + 19} 115`,
    `C${x + 25} 125 ${x + 34} 130 ${x + 44} 130`,
    `C${x + 59} 130 ${x + 70} 118 ${x + 70} 102`,
    `C${x + 70} 86 ${x + 60} 76 ${x + 47} 76`,
    `C${x + 37} 76 ${x + 29} 81 ${x + 24} 87`,
    `L${x + 4.5} 84Z`,
  ].join("");
}

function DigitShape({ digit, x }: { digit: Digit; x: number }) {
  switch (digit) {
    case "0":
      return <ZeroRing cx={x + DIGIT_WIDTH / 2} />;
    case "4":
      return (
        <path className={styles.digit} fillRule="evenodd" d={fourPath(x)} />
      );
    case "5":
      return <path className={styles.digit} d={fivePath(x)} />;
  }
}

function ZeroRing({ cx }: { cx: number }) {
  return (
    <>
      <ellipse
        className={styles.digit}
        cx={cx}
        cy={ZERO_CENTER_Y}
        rx={ZERO_OUTER.rx}
        ry={ZERO_OUTER.ry}
      />
      <ellipse
        className={styles.hole}
        cx={cx}
        cy={ZERO_CENTER_Y}
        rx={ZERO_INNER.rx}
        ry={ZERO_INNER.ry}
      />
    </>
  );
}

// 猫の顔は RecordIcons の猫と同じ形（24px グリッド）を拡大して描く
const catFace =
  "M5 7V2l4 2.5a12 12 0 0 1 6 0L19 2v5a4 4 0 0 1 1 2.5c0 3-3.5 5-8 5s-8-2-8-5A4 4 0 0 1 5 7Z";
const CAT_SCALE = 2.5;
/** 顔の上端（耳の先）の y。0 の穴の下のほうから顔を出す */
const CAT_TOP = 88;

/**
 * 0 の穴からのぞく猫と、0 の後ろから出ているしっぽ。
 * 顔は穴の形で切り抜き、前足は穴の縁にかける
 */
function PeekingCat({ cx, clipId }: { cx: number; clipId: string }) {
  const faceTransform = `translate(${cx - 12 * CAT_SCALE} ${CAT_TOP - 2 * CAT_SCALE}) scale(${CAT_SCALE})`;
  // 前足は、穴の縁が顔の下の端の高さで左右に広がる位置に置く
  const pawY = 118;
  const pawOffsetX = 11;

  return (
    <>
      <clipPath id={clipId}>
        <ellipse
          cx={cx}
          cy={ZERO_CENTER_Y}
          rx={ZERO_INNER.rx}
          ry={ZERO_INNER.ry}
        />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g transform={faceTransform} className={styles.catLine}>
          <path
            className={styles.catCoat}
            fill={DEFAULT_CAT_COAT}
            d={catFace}
          />
          <path className={styles.catEar} d="M6.5 4.5v2l2-1Zm11 0v2l-2-1Z" />
          <circle className={styles.catEye} cx="8.5" cy="9" r="1.1" />
          <circle className={styles.catEye} cx="15.5" cy="9" r="1.1" />
          <path fill="none" d="m11 11 1 1 1-1" />
        </g>
      </g>
      {/* 穴の縁の線を顔の上に描き直し、顔が穴の奥にあるように見せる */}
      <ellipse
        className={styles.holeRim}
        cx={cx}
        cy={ZERO_CENTER_Y}
        rx={ZERO_INNER.rx}
        ry={ZERO_INNER.ry}
      />
      <g className={styles.pawLine}>
        <ellipse
          className={styles.catCoat}
          cx={cx - pawOffsetX}
          cy={pawY}
          rx="4.5"
          ry="3.5"
        />
        <ellipse
          className={styles.catCoat}
          cx={cx + pawOffsetX}
          cy={pawY}
          rx="4.5"
          ry="3.5"
        />
      </g>
    </>
  );
}

/** 0 の右下の後ろから伸び、くるんと上を向くしっぽ */
function Tail({ cx }: { cx: number }) {
  const d = [
    `M${cx + 20} 135`,
    `C${cx + 38} 150 ${cx + 54} 154 ${cx + 62} 145`,
    `C${cx + 68} 137 ${cx + 65} 127 ${cx + 58} 130`,
  ].join("");

  return (
    <>
      <path className={styles.tailOutline} d={d} />
      <path className={styles.tailCoat} d={d} />
    </>
  );
}

/**
 * エラーページの大きな数字のイラスト。2 文字目の 0 の穴から猫がのぞき、0 の後ろからしっぽが出ている
 * （Issue #613 のイメージ）。数字は文字ではなく図形で描き、フォントによって形が変わらないようにする
 */
export function ErrorCodeIllustration({ code }: { code: ErrorCode }) {
  const clipId = useId();
  const [first, second, third] = CODE_DIGITS[code];
  const catCx = digitLeft(1) + DIGIT_WIDTH / 2;

  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 310 162"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <Tail cx={catCx} />
      <DigitShape digit={first} x={digitLeft(0)} />
      <DigitShape digit={second} x={digitLeft(1)} />
      <DigitShape digit={third} x={digitLeft(2)} />
      <PeekingCat cx={catCx} clipId={clipId} />
    </svg>
  );
}
