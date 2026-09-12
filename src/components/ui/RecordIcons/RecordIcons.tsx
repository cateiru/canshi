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

function CatFill({ transform }: { transform?: string }) {
  return (
    <>
      <path fill="#f5dfb7" d={catFace} transform={transform} />
      <path
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
}: {
  transform?: string;
  expression?: "happy" | "calm" | "unwell";
}) {
  const eyes = {
    happy: "m7 9 1-1 1 1m6 0 1-1 1 1",
    calm: "M8 9h.01M16 9h.01",
    unwell: "m7 8 2 1-2 1m10-2-2 1 2 1",
  };

  return (
    <g transform={transform}>
      <path d={catFace} />
      <path d={eyes[expression]} />
      <path d={expression === "unwell" ? "M11 12h2" : "m11 11 1 1 1-1"} />
    </g>
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
  const catTransform = "translate(-1 2) scale(.85)";

  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <CatFill transform={catTransform} />
          <path fill="#8dcde9" d={bowl} />
          <path fill="#8dcde9" d={drop} />
          <path fill="#f4b0a3" d="M8 14v1.5a1.5 1.5 0 0 0 3 0v-1.5Z" />
        </>
      }
    >
      <CatOutline transform={catTransform} />
      <path d={bowl} />
      <path d={drop} />
      <path d="M8 14v1.5a1.5 1.5 0 0 0 3 0v-1.5" />
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
      <CatOutline transform={catTransform} />
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
          <rect fill="#fff4df" x="4" y="15" width="16" height="7" rx="3.5" />
          <path fill="#739fdf" d="M12 15h4.5a3.5 3.5 0 0 1 0 7H12Z" />
        </>
      }
    >
      <CatOutline />
      <rect x="4" y="15" width="16" height="7" rx="3.5" />
      <path d="M12 15v7" />
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
          <path fill="#f5dfb7" d="M7 18c0-4 10-4 10 0Z" />
          <CatFill transform={catTransform} />
          <path fill="#fff4df" d="M3 18h18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />
        </>
      }
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 18c0-4 10-4 10 0" />
      <CatOutline transform={catTransform} />
      <path d="M3 18h18" />
    </RecordIcon>
  );
}
