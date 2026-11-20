import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType, CSSProperties } from "react";
import * as RecordIcons from "./RecordIcons";

type IconComponent = ComponentType<RecordIcons.RecordIconProps>;

/** RecordIcons から export しているアイコンのコンポーネント（名前が Icon で終わる関数）だけを並べる */
const icons = Object.entries(RecordIcons as Record<string, unknown>).filter(
  (entry): entry is [string, IconComponent] =>
    entry[0].endsWith("Icon") && typeof entry[1] === "function",
);

type IconGalleryProps = {
  /** 標準の文字サイズでの大きさ（px） */
  size: number;
};

function IconGallery({ size }: IconGalleryProps) {
  return (
    <ul
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 16,
        listStyle: "none",
      }}
    >
      {icons.map(([name, Icon]) => (
        <li
          key={name}
          style={{
            display: "grid",
            justifyItems: "center",
            gap: 8,
            fontSize: "var(--text-xs)",
          }}
        >
          <Icon size={size} aria-hidden="true" />
          <code>{name}</code>
        </li>
      ))}
    </ul>
  );
}

const meta = {
  title: "表示/RecordIcons",
  component: IconGallery,
  args: {
    size: 48,
  },
  argTypes: {
    size: { control: { type: "range", min: 16, max: 128, step: 4 } },
  },
} satisfies Meta<typeof IconGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {};

/** ねこの顔は、毛色を CSS 変数（--illustration-cat-coat）で塗り替えられる */
export const CatCoat: Story = {
  render: ({ size }) => (
    <div style={{ display: "flex", gap: 16 }}>
      {["#f5dfb7", "#e9a35f", "#ffffff", "#b5b5b5"].map((coat) => (
        <span
          key={coat}
          style={
            { [RecordIcons.CAT_COAT_FILL_VARIABLE]: coat } as CSSProperties
          }
        >
          <RecordIcons.CatFaceIcon size={size} aria-label={coat} />
        </span>
      ))}
    </div>
  ),
};
