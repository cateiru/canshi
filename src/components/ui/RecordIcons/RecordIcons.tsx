import type { ReactNode } from "react";
import { IconBase, type IconBaseProps } from "react-icons";
import styles from "./RecordIcons.module.css";

export type RecordIconProps = IconBaseProps & {
  monochrome?: boolean;
};

// 既存の Tabler アイコンと同じ 24px グリッド・2px 線・丸い線端。
const outlineAttributes = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
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

// Tabler Icons (MIT) のパスを基に、輪郭とカラーの塗りを重ねる。
// 出典・ライセンスは同ディレクトリの LICENSE.tabler を参照。
export function FeedingIcon(props: RecordIconProps) {
  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path
            fill="#f5dfb7"
            d="M13.62 8.382l1.966-1.967a2 2 0 1 1 3.414-1.415a2 2 0 1 1-1.413 3.414l-1.82 1.821Z"
          />
          <path
            fill="#e99a70"
            d="M12.975 21.425c3.905-3.906 4.855-9.288 2.121-12.021c-2.733-2.734-8.115-1.784-12.02 2.121Z"
          />
          <path
            fill="#f4b0a3"
            d="M5.904 18.596c2.733 2.734 5.9 4 7.07 2.829c1.172-1.172-.094-4.338-2.828-7.071c-2.733-2.734-5.9-4-7.07-2.829c-1.172 1.172.094 4.338 2.828 7.071"
          />
        </>
      }
    >
      <path d="M13.62 8.382l1.966-1.967a2 2 0 1 1 3.414-1.415a2 2 0 1 1-1.413 3.414l-1.82 1.821" />
      <path d="M5.904 18.596c2.733 2.734 5.9 4 7.07 2.829c1.172-1.172-.094-4.338-2.828-7.071c-2.733-2.734-5.9-4-7.07-2.829c-1.172 1.172.094 4.338 2.828 7.071" />
      <path d="M7.5 16l1 1M12.975 21.425c3.905-3.906 4.855-9.288 2.121-12.021c-2.733-2.734-8.115-1.784-12.02 2.121" />
    </RecordIcon>
  );
}

export function PoopIcon(props: RecordIconProps) {
  return (
    <RecordIcon
      {...props}
      fills={
        <path
          fill="#c99a72"
          d="M8 10c-1-3 5-3 4-7 4 1 6 4 4 7a3 3 0 0 1 2 5 3 3 0 0 1 0 6H6a3 3 0 0 1 0-6 3 3 0 0 1 2-5Z"
        />
      }
    >
      <path d="M8 10c-1-3 5-3 4-7 4 1 6 4 4 7a3 3 0 0 1 2 5 3 3 0 0 1 0 6H6a3 3 0 0 1 0-6 3 3 0 0 1 2-5Z" />
      <path d="M8 10h5M6 15h10" />
    </RecordIcon>
  );
}

export function WeightIcon(props: RecordIconProps) {
  return (
    <RecordIcon
      {...props}
      fills={
        <path
          fill="#b9ace8"
          d="M6.835 9h10.33a1 1 0 0 1 .984.821l1.637 9a1 1 0 0 1-.984 1.179H5.198a1 1 0 0 1-.984-1.179l1.637-9a1 1 0 0 1 .984-.821"
        />
      }
    >
      <path d="M9 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
      <path d="M6.835 9h10.33a1 1 0 0 1 .984.821l1.637 9a1 1 0 0 1-.984 1.179H5.198a1 1 0 0 1-.984-1.179l1.637-9a1 1 0 0 1 .984-.821" />
    </RecordIcon>
  );
}

export function VomitIcon(props: RecordIconProps) {
  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path
            fill="#f5dfb7"
            d="M6 3h12c1.657 0 3 3.134 3 7v10l-3-1-3 2-3-3-3 2V10Z"
          />
          <ellipse fill="#fff4df" cx="6" cy="10" rx="3" ry="7" />
        </>
      }
    >
      <path d="M3 10a3 7 0 1 0 6 0a3 7 0 1 0-6 0M21 10c0-3.866-1.343-7-3-7M6 3h12M21 10v10l-3-1-3 2-3-3-3 2V10M6 10h.01" />
    </RecordIcon>
  );
}

export function WaterIcon(props: RecordIconProps) {
  const drop =
    "M7.502 19.423c2.602 2.105 6.395 2.105 8.996 0c2.602-2.105 3.262-5.708 1.566-8.546l-4.89-7.26c-.42-.625-1.287-.803-1.936-.397a1.376 1.376 0 0 0-.41.397l-4.893 7.26c-1.695 2.838-1.035 6.441 1.567 8.546";
  return (
    <RecordIcon {...props} fills={<path fill="#8dcde9" d={drop} />}>
      <path d={drop} />
    </RecordIcon>
  );
}

export function ShampooIcon(props: RecordIconProps) {
  const bath =
    "M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1";
  return (
    <RecordIcon {...props} fills={<path fill="#91d4c4" d={bath} />}>
      <path d={bath} />
      <path d="M6 12V5a2 2 0 0 1 2-2h3v2.25M4 21l1-1.5M20 21l-1-1.5" />
    </RecordIcon>
  );
}

export function BroomIcon(props: RecordIconProps) {
  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path fill="#e99a70" d="m9 11 2-3 5 4-2 3Z" />
          <path fill="#f2d17b" d="m9 11 5 4-3 6c-3 0-6-2-8-4Z" />
        </>
      }
    >
      <path d="m13.5 10 6.5-7" />
      <path d="m9 11 2-3 5 4-2 3" />
      <path d="m9 11 5 4-3 6c-3 0-6-2-8-4Z" />
      <path d="m8 16-2 3m5-1-1 3" />
    </RecordIcon>
  );
}

export function SymptomIcon(props: RecordIconProps) {
  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path fill="#ffe5df" d="M10 13.5a4 4 0 1 0 4 0V5a2 2 0 0 0-4 0v8.5" />
          <path fill="#f4a397" d="M10 9h4v4.5a4 4 0 1 1-4 0Z" />
        </>
      }
    >
      <path d="M10 13.5a4 4 0 1 0 4 0V5a2 2 0 0 0-4 0v8.5M10 9h4" />
    </RecordIcon>
  );
}

export function MedicationIcon(props: RecordIconProps) {
  const pill = "M4.5 12.5l8-8a4.94 4.94 0 0 1 7 7l-8 8a4.94 4.94 0 0 1-7-7";
  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path fill="#fff4df" d={pill} />
          <path fill="#739fdf" d="m8.5 8.5 4-4a4.94 4.94 0 0 1 7 7l-4 4Z" />
        </>
      }
    >
      <path d={pill} />
      <path d="m8.5 8.5 7 7" />
    </RecordIcon>
  );
}

export function HospitalIcon(props: RecordIconProps) {
  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <path fill="#b7d7ee" d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
          <path fill="#f4fbff" d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4Z" />
        </>
      }
    >
      <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4M10 9h4M12 7v4" />
    </RecordIcon>
  );
}

export function PhotoIcon(props: RecordIconProps) {
  return (
    <RecordIcon
      {...props}
      fills={
        <>
          <rect fill="#d0e9f4" x="3" y="3" width="18" height="18" rx="3" />
          <path
            fill="#b2d3aa"
            d="m14 14 1-1c.928-.893 2.072-.893 3 0l3 3v2a3 3 0 0 1-3 3h-4Z"
          />
          <path
            fill="#8cbea4"
            d="m3 16 5-5c.928-.893 2.072-.893 3 0l5 5 2 5H6a3 3 0 0 1-3-3Z"
          />
          <circle fill="#f2d17b" cx="15" cy="8" r="2" />
        </>
      }
    >
      <path d="M15 8h.01M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6M3 16l5-5c.928-.893 2.072-.893 3 0l5 5M14 14l1-1c.928-.893 2.072-.893 3 0l3 3" />
    </RecordIcon>
  );
}
