import type { ReactNode } from "react";
import { IconBase, type IconBaseProps } from "react-icons";
import styles from "./RecordIcons.module.css";

export type RecordIconProps = IconBaseProps & {
  monochrome?: boolean;
};

// 24px グリッド・1.5px 線・丸い線端。SVG のまま描画し、拡大時も鮮明に保つ。
const outlineAttributes = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.5",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function RecordIcon({
  monochrome = false,
  className,
  fills,
  children,
  ...props
}: RecordIconProps & { fills: ReactNode }) {
  return (
    <IconBase
      attr={outlineAttributes}
      stroke={monochrome ? "currentColor" : "var(--color-ink, #2e3142)"}
      className={[monochrome && styles.monochrome, className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <g className={styles.fills} stroke="none">
        {fills}
      </g>
      {children}
    </IconBase>
  );
}

// 猫の塗りと輪郭を分け、単色表示でも道具と顔を見分けられるようにする。
const catFace =
  "M5 7V2l4 2.5a12 12 0 0 1 6 0L19 2v5a4 4 0 0 1 1 2.5c0 3-3.5 5-8 5s-8-2-8-5A4 4 0 0 1 5 7Z";

function CatFill({
  transform,
  className,
}: {
  transform?: string;
  className?: string;
}) {
  return (
    <>
      <path
        className={className}
        fill="#f5dfb7"
        d={catFace}
        transform={transform}
      />
      <path
        className={className}
        fill="#f4b0a3"
        d="M6.5 4.5v2l2-1Zm11 0v2l-2-1Z"
        transform={transform}
      />
    </>
  );
}

function CatOutline({
  transform,
  expression = "happy",
  facePath = catFace,
  showMouth = true,
  eyesOffsetY = 0,
}: {
  transform?: string;
  expression?: "happy" | "calm" | "unwell";
  facePath?: string;
  showMouth?: boolean;
  eyesOffsetY?: number;
}) {
  const eyes = {
    happy: "m7 9 1-1 1 1m6 0 1-1 1 1",
    calm: "M8 9h.01M16 9h.01",
    unwell: "m7 8 2 1-2 1m10-2-2 1 2 1",
  };

  return (
    <g transform={transform}>
      <path d={facePath} />
      <path d={eyes[expression]} transform={`translate(0 ${eyesOffsetY})`} />
      {showMouth && (
        <path d={expression === "unwell" ? "M11 12h2" : "m11 11 1 1 1-1"} />
      )}
    </g>
  );
}

export function CatFaceIcon(props: RecordIconProps) {
  const catTransform = "translate(-2.4 2.1) scale(1.2)";

  return (
    <RecordIcon {...props} fills={<CatFill transform={catTransform} />}>
      <CatOutline transform={catTransform} expression="calm" />
    </RecordIcon>
  );
}

export function FeedingIcon(props: RecordIconProps) {
  const bowl = "M3 16h18l-1.5 4a3 3 0 0 1-2.8 2H7.3a3 3 0 0 1-2.8-2Z";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <CatFill />
          <path fill="#e99a70" d={bowl} />
        </>
      }
    >
      <CatOutline />
      <path d={bowl} />
      <path d="M10 19h4" />
    </RecordIcon>
  );
}

export function CalorieIcon(props: RecordIconProps) {
  const catTransform = "translate(0 7)";
  const flames =
    "M5 22C1.5 20 1 15.5 2.5 12L4 14C2.5 9 6 7.5 5.5 4.5 8 5.5 9 7 9 8.5 11 6.5 10 3.5 13 1.5 12.5 5 16.5 5 16.5 8L19 5.5C18.5 9.5 22 10.5 20.5 14L22 12.5C23 17 21.5 20.5 19 22Q12 23 5 22Z";
  const leftEye =
    "M8.5 13C8.8 13.8 7.5 13.8 8 14.6L9.3 14C9.6 14.5 10 14.8 10 15.4 9.7 16.5 7.8 17 7 15.8 6.2 14.5 7.5 14.2 8.5 13Z";
  const rightEye =
    "M15.5 13C15.2 13.8 16.5 13.8 16 14.6L14.7 14C14.4 14.5 14 14.8 14 15.4 14.3 16.5 16.2 17 17 15.8 17.8 14.5 16.5 14.2 15.5 13Z";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path fill="#e99a70" d={flames} />
          <path fill="#f2d17b" d="M9 10c0-3 3-3 3-6 3 3 3 5 3 7Z" />
          <CatFill transform={catTransform} />
          <path fill="#ed795b" d={leftEye} />
          <path fill="#ed795b" d={rightEye} />
        </>
      }
    >
      <path d={flames} />
      <path d={catFace} transform={catTransform} />
      <path d={leftEye} strokeWidth="1" />
      <path d={rightEye} strokeWidth="1" />
      <path d="m11 18 1 1 1-1" />
    </RecordIcon>
  );
}

export function PoopIcon(props: RecordIconProps) {
  const catTransform = "translate(-1 1) scale(.8)";
  const poop =
    "M16 14c-1-1.5 2-2 1-4 3 .5 4 2.5 3 4a2 2 0 0 1 1 4h-6a2 2 0 0 1 1-4Z";
  const tray = "M2 18h20l-1 4H3Z";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path fill="#f5dfb7" d="M5 12.5c-1.5 1.5-2 3.5-1 5.5h8l-1-5.5Z" />
          <CatFill transform={catTransform} />
          <path fill="#c99a72" d={poop} />
          <path fill="#d7c4e9" d={tray} />
        </>
      }
    >
      <path d="M5 12.5c-1.5 1.5-2 3.5-1 5.5m7-5.5 1 5.5M7 15v3" />
      <CatOutline transform={catTransform} expression="calm" />
      <path d={poop} />
      <path d={tray} />
    </RecordIcon>
  );
}

export function WeightIcon(props: RecordIconProps) {
  const catTransform = "translate(1.2 0) scale(.9)";
  const pan = "M3 13h18l-2 2H5Z";
  const scale = "M8 15h8l2 7H6Z";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <CatFill transform={catTransform} />
          <path fill="#b9ace8" d={scale} />
          <path fill="#d7c4e9" d={pan} />
          <circle fill="#fff4df" cx="12" cy="18.5" r="2" />
        </>
      }
    >
      <CatOutline transform={catTransform} expression="calm" />
      <path d={scale} />
      <path d={pan} />
      <circle cx="12" cy="18.5" r="2" />
      <path d="m12 18.5 1-1" />
    </RecordIcon>
  );
}

export function VomitIcon(props: RecordIconProps) {
  const face =
    "M4 9V3l5 3a12 12 0 0 1 6 0l5-3v6a6 6 0 0 1 1 3c0 3.5-4 6-9 6s-9-2.5-9-6a6 6 0 0 1 1-3Z";
  const vomit = "M10 15h4l.5 4H16a1.5 1.5 0 0 1 0 3H8a1.5 1.5 0 0 1 0-3h1.5Z";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path fill="#f5dfb7" d={face} />
          <path fill="#f4b0a3" d="M5.5 5.5v3l2-1.5Zm13 0v3l-2-1.5Z" />
          <path fill="#b2d3aa" d={vomit} />
        </>
      }
    >
      <path d="M9.5 17.8C5.7 17.1 3 14.9 3 12a6 6 0 0 1 1-3V3l5 3a12 12 0 0 1 6 0l5-3v6a6 6 0 0 1 1 3c0 2.9-2.7 5.1-6.5 5.8" />
      <path d="m7 10 2 1.5L7 13m10-3-2 1.5 2 1.5" />
      <path d="m2 14 2 .5m18-.5-2 .5" />
      <path d={vomit} />
    </RecordIcon>
  );
}

export function WaterIcon(props: RecordIconProps) {
  const bowl = "M3 17h18l-1.5 3a3 3 0 0 1-2.7 2H7.2a3 3 0 0 1-2.7-2Z";
  const drop = "M20 10s-2 2.5-2 3.5a2 2 0 0 0 4 0c0-1-2-3.5-2-3.5Z";
  const tongue = "M7.7 14.2v1.3a1.5 1.5 0 0 0 3 0v-1.3";
  const catTransform = "translate(-1 2) scale(.85)";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <CatFill transform={catTransform} />
          <path fill="#8dcde9" d={bowl} />
          <path fill="#8dcde9" d={drop} />
          <path fill="#f4b0a3" d={`${tongue}Z`} />
        </>
      }
    >
      {/* 舌の付け根を顎の輪郭に重ね、線端が顔の内側へ飛び出さないようにする。 */}
      <path d={tongue} strokeLinecap="butt" />
      <CatOutline transform={catTransform} showMouth={false} eyesOffsetY={1} />
      <path d={bowl} />
      <path d={drop} />
    </RecordIcon>
  );
}

export function ShampooIcon(props: RecordIconProps) {
  const catTransform = "translate(0 1) scale(.85)";
  const bath = "M2 15h20v2a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <CatFill transform={catTransform} />
          <path fill="#91d4c4" d={bath} />
          <circle fill="#d0eef3" cx="20" cy="5" r="2" />
          <circle fill="#d0eef3" cx="21" cy="11" r="1" />
        </>
      }
    >
      <CatOutline transform={catTransform} />
      <path d={bath} />
      <path d="M5 21v1m14-1v1" />
      <circle cx="20" cy="5" r="2" />
      <circle cx="21" cy="11" r="1" />
    </RecordIcon>
  );
}

export function BroomIcon(props: RecordIconProps) {
  const catTransform = "translate(-1 2) scale(.75)";
  const broom = "m16 13 4 1 2 7h-9Z";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path fill="#f5dfb7" d="M5 12.5c-2 2.5-2 5.5-1 8.5h7l.5-8.5Z" />
          <CatFill transform={catTransform} />
          <path fill="#f2d17b" d={broom} />
          <path fill="#e99a70" d="m16 13 4 1 .571 2-5.321-1Z" />
        </>
      }
    >
      <path d="M5 12.5c-2 2.5-2 5.5-1 8.5h7l.5-8.5M7 17v4M4 20c-3 0-3-3-2-4" />
      <CatOutline transform={catTransform} expression="calm" />
      <path d="m20 3-2 10.5" />
      <path d={broom} />
      <path d="m15.25 15 5.321 1" strokeLinecap="butt" />
      <path d="M18 18v3" />
    </RecordIcon>
  );
}

export function SymptomIcon(props: RecordIconProps) {
  const catTransform = "translate(-1 4) scale(.85)";
  const thermometer = "M18 16V5a2 2 0 0 1 4 0v11a3 3 0 1 1-4 0Z";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <CatFill transform={catTransform} />
          <ellipse fill="#f4b0a3" cx="4.5" cy="14" rx="1.5" ry="1" />
          <ellipse fill="#f4b0a3" cx="13.5" cy="14" rx="1.5" ry="1" />
          <path fill="#ffe5df" d={thermometer} />
          <path fill="#f4a397" d="M18 12h4v4a3 3 0 1 1-4 0Z" />
        </>
      }
    >
      <CatOutline transform={catTransform} expression="unwell" />
      <path d={thermometer} />
    </RecordIcon>
  );
}

export function MedicationIcon(props: RecordIconProps) {
  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <CatFill />
          <rect fill="#fff4df" x="5" y="12.5" width="14" height="7" rx="3.5" />
          <path fill="#739fdf" d="M12 12.5h3.5a3.5 3.5 0 0 1 0 7H12Z" />
        </>
      }
    >
      <CatOutline
        expression="calm"
        facePath="M7 12.85C5.1 12 4 10.8 4 9.5A4 4 0 0 1 5 7V2l4 2.5a12 12 0 0 1 6 0L19 2v5a4 4 0 0 1 1 2.5c0 1.3-1.1 2.5-3 3.35"
      />
      <rect x="5" y="12.5" width="14" height="7" rx="3.5" />
      <path d="M12 12.5v7" />
    </RecordIcon>
  );
}

export function HospitalIcon(props: RecordIconProps) {
  const catTransform = "translate(3.5 10) scale(.65)";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <rect fill="#b7d7ee" x="2" y="6" width="20" height="16" rx="3" />
          <CatFill transform={catTransform} />
        </>
      }
    >
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <rect x="2" y="6" width="20" height="16" rx="3" />
      <CatOutline transform={catTransform} expression="calm" />
      <path d="M16 10h4m-2-2v4" />
    </RecordIcon>
  );
}

export function PhotoIcon(props: RecordIconProps) {
  const catTransform = "translate(3 5) scale(.75)";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <rect fill="#d0e9f4" x="3" y="3" width="18" height="18" rx="3" />
          <path fill="#f5dfb7" d="M8 18c0-1 .8-1.8 2-2h4c1.2.2 2 1 2 2Z" />
          <CatFill transform={catTransform} />
          <path fill="#fff4df" d="M3 18h18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />
        </>
      }
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 18c0-1 .8-1.8 2-2m4 0c1.2.2 2 1 2 2" strokeLinecap="butt" />
      <CatOutline transform={catTransform} />
      <path d="M3 18h18" />
    </RecordIcon>
  );
}

export function ExpenseIcon(props: RecordIconProps) {
  const catTransform = "translate(1.5 0) scale(.8)";
  const body = "M8 11C6.5 13 6 17 6.5 21Q12 23 18 21C18.5 17 18 13 16 11";
  const coinTransform = "rotate(15 15 16.25)";
  const paw = "M8.5 15.5 11 16a1.5 1.5 0 0 1-.5 3L8 18";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path fill="#f5dfb7" d={body} />
          <path fill="#e99a70" d="M8 11h8v2H8Z" />
        </>
      }
    >
      <path d={body} />
      <path d="M8 12.5h8" />
      {/* 胴体と首輪の線を顔の塗りで隠し、小判と抱える手をさらに手前に重ねる。 */}
      <g stroke="none">
        <CatFill transform={catTransform} className={styles.foregroundFill} />
      </g>
      <CatOutline transform={catTransform} expression="calm" />
      <g transform={coinTransform}>
        <ellipse
          className={styles.foregroundFill}
          fill="#f2d17b"
          cx="15"
          cy="16.25"
          rx="5.25"
          ry="6.25"
        />
        <path
          d="M12.5 13.75h5m-5 2.5h5m-5 2.5h5"
          stroke={props.monochrome ? "currentColor" : "#d2a52a"}
          strokeWidth="1"
        />
      </g>
      <path className={styles.foregroundFill} fill="#f5dfb7" d={paw} />
    </RecordIcon>
  );
}

export function NotificationSettingsIcon(props: RecordIconProps) {
  const catTransform = "translate(-1 0) scale(.85)";
  const bell = "M17 10a3 3 0 0 1 3 3v3l1 2h-8l1-2v-3a3 3 0 0 1 3-3Z";

  return (
    <RecordIcon {...props} fills={<CatFill transform={catTransform} />}>
      <CatOutline transform={catTransform} expression="calm" />
      <path
        className={styles.foregroundFill}
        fill="#f2d17b"
        stroke="none"
        d={bell}
      />
      <path d={bell} />
      <path d="M17 8.5v1.5m-1 10h2" />
    </RecordIcon>
  );
}

export function FoodProductIcon(props: RecordIconProps) {
  const catTransform = "translate(-1 0) scale(.85)";
  const bag = "M14 8h7l1 13h-9Z";

  return (
    <RecordIcon {...props} fills={<CatFill transform={catTransform} />}>
      <CatOutline transform={catTransform} expression="calm" />
      <path
        className={styles.foregroundFill}
        fill="#e99a70"
        stroke="none"
        d={bag}
      />
      <path d={bag} />
      <path d="M15 8V5h5v3m-4 6h3m-3 3h3" />
    </RecordIcon>
  );
}

export function FeedingPresetIcon(props: RecordIconProps) {
  const catTransform = "translate(0 -1) scale(.85)";
  const clipboard = "M5 12h14v10H5Z";

  return (
    <RecordIcon {...props} fills={<CatFill transform={catTransform} />}>
      <CatOutline transform={catTransform} expression="calm" />
      <path
        className={styles.foregroundFill}
        fill="#d7c4e9"
        stroke="none"
        d={clipboard}
      />
      <path d={clipboard} />
      <path d="M9 15h6m-6 3h6" />
    </RecordIcon>
  );
}

export function ReleaseNotesIcon(props: RecordIconProps) {
  const catTransform = "translate(-1 0) scale(.85)";
  const paper = "M13 9h9v12h-9Z";

  return (
    <RecordIcon {...props} fills={<CatFill transform={catTransform} />}>
      <CatOutline transform={catTransform} expression="calm" />
      <path
        className={styles.foregroundFill}
        fill="#b7d7ee"
        stroke="none"
        d={paper}
      />
      <path d={paper} />
      <path d="M16 12h3m-3 3h3m-3 3h3" />
    </RecordIcon>
  );
}
