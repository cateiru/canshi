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

// 数字は 1 文字あたり幅 100・高さ 140（y = 10〜150）の枠に描き、12 ずつ空けて並べる。
// 太字に見えるよう、線の太さ（棒の幅）はおよそ 28 にそろえる
const DIGIT_WIDTH = 100;
const DIGIT_GAP = 12;
const MARGIN_X = 5;
const VIEW_BOX_WIDTH = MARGIN_X * 2 + DIGIT_WIDTH * 3 + DIGIT_GAP * 2;
const ZERO_CENTER_Y = 80;
const ZERO_OUTER = { rx: 50, ry: 70 };
const ZERO_INNER = { rx: 21, ry: 43 };

function digitLeft(index: number) {
  return MARGIN_X + index * (DIGIT_WIDTH + DIGIT_GAP);
}

/** 斜めの線と横棒の「4」。内側の三角形を evenodd でくり抜く */
function fourPath(x: number) {
  return [
    `M${x + 56} 10H${x + 84}V96H${x + 100}V122H${x + 84}V150H${x + 56}V122H${x}V96Z`,
    `M${x + 56} 57.7V96H${x + 31}Z`,
  ].join("");
}

/** 上の横棒・左の縦棒・下の丸い腹からなる「5」 */
function fivePath(x: number) {
  return [
    `M${x + 6} 10H${x + 94}V38H${x + 34}L${x + 33} 58`,
    `C${x + 40} 55 ${x + 48} 54 ${x + 55} 54`,
    `C${x + 82} 54 ${x + 100} 74 ${x + 100} 102`,
    `C${x + 100} 131 ${x + 78} 150 ${x + 50} 150`,
    `C${x + 30} 150 ${x + 12} 142 ${x + 2} 127`,
    `L${x + 24} 111`,
    `C${x + 30} 119 ${x + 39} 123 ${x + 49} 123`,
    `C${x + 63} 123 ${x + 72} 114 ${x + 72} 102`,
    `C${x + 72} 89 ${x + 63} 81 ${x + 50} 81`,
    `C${x + 42} 81 ${x + 35} 84 ${x + 31} 89`,
    `L${x + 4} 85Z`,
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

/** 楕円を 2 つの円弧で描くパス。evenodd で重ねて 0 の穴をくり抜くのに使う */
function ellipsePath(cx: number, { rx, ry }: { rx: number; ry: number }) {
  return `M${cx - rx} ${ZERO_CENTER_Y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
}

/** 「0」。穴は塗らずにくり抜き、背景が透けて見えるようにする */
function ZeroRing({ cx }: { cx: number }) {
  return (
    <path
      className={styles.digit}
      fillRule="evenodd"
      d={ellipsePath(cx, ZERO_OUTER) + ellipsePath(cx, ZERO_INNER)}
    />
  );
}

// 猫の顔は RecordIcons の猫と同じ形（24px グリッド）を拡大して描く
const catFace =
  "M5 7V2l4 2.5a12 12 0 0 1 6 0L19 2v5a4 4 0 0 1 1 2.5c0 3-3.5 5-8 5s-8-2-8-5A4 4 0 0 1 5 7Z";
const CAT_SCALE = 2.2;
/** 顔の上端（耳の先）の y。0 の穴の下のほうから顔を出す */
const CAT_TOP = 94;

/**
 * 0 の穴からのぞく猫と、0 の後ろから出ているしっぽ。
 * 顔は穴の形で切り抜き、前足は穴の縁にかける
 */
function PeekingCat({ cx, clipId }: { cx: number; clipId: string }) {
  const faceTransform = `translate(${cx - 12 * CAT_SCALE} ${CAT_TOP - 2 * CAT_SCALE}) scale(${CAT_SCALE})`;
  // 前足は、穴の縁が顔の下の端の高さで左右に広がる位置に置く
  const pawY = 119;
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
    `M${cx + 22} 135`,
    `C${cx + 40} 152 ${cx + 56} 156 ${cx + 64} 147`,
    `C${cx + 70} 139 ${cx + 67} 129 ${cx + 60} 132`,
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
      viewBox={`0 0 ${VIEW_BOX_WIDTH} 162`}
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
