import { IconBase, type IconBaseProps } from "react-icons";

// 既存の Tabler アイコンと同じ 24px グリッド・2px 線・丸い線端。
const outlineAttributes = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function PoopIcon(props: IconBaseProps) {
  return (
    <IconBase attr={outlineAttributes} {...props}>
      <path d="M8 10c-1-3 5-3 4-7 4 1 6 4 4 7a3 3 0 0 1 2 5 3 3 0 0 1 0 6H6a3 3 0 0 1 0-6 3 3 0 0 1 2-5Z" />
      <path d="M8 10h5M6 15h10" />
    </IconBase>
  );
}

export function BroomIcon(props: IconBaseProps) {
  return (
    <IconBase attr={outlineAttributes} {...props}>
      <path d="m13.5 10 6.5-7" />
      <path d="m9 11 2-3 5 4-2 3" />
      <path d="m9 11 5 4-3 6c-3 0-6-2-8-4Z" />
      <path d="m8 16-2 3m5-1-1 3" />
    </IconBase>
  );
}
