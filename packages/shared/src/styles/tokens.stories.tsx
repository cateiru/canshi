import type { Meta, StoryObj } from "@storybook/react-vite";
import tokensCss from "./tokens.css?raw";

/** tokens.css で定義している CSS カスタムプロパティのうち、指定した接頭辞で始まるものの名前（重複なし） */
function tokenNames(prefix: string): string[] {
  const pattern = new RegExp(`(${prefix}[\\w-]*)\\s*:`, "g");
  return [
    ...new Set([...tokensCss.matchAll(pattern)].map((match) => match[1])),
  ];
}

function ColorTokens() {
  return (
    <ul
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12,
        listStyle: "none",
      }}
    >
      {tokenNames("--color-").map((name) => (
        <li
          key={name}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: `var(${name})`,
            }}
          />
          <code style={{ fontSize: "var(--text-xs)", wordBreak: "break-all" }}>
            {name}
          </code>
        </li>
      ))}
    </ul>
  );
}

function TextTokens() {
  return (
    <ul style={{ display: "grid", gap: 8, listStyle: "none" }}>
      {tokenNames("--text-").map((name) => (
        <li key={name} style={{ fontSize: `var(${name})` }}>
          <code>{name}</code> ねこの記録
        </li>
      ))}
    </ul>
  );
}

function SpaceTokens() {
  return (
    <ul style={{ display: "grid", gap: 8, listStyle: "none" }}>
      {tokenNames("--space-").map((name) => (
        <li
          key={name}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <code style={{ width: 96 }}>{name}</code>
          <span
            aria-hidden="true"
            style={{
              width: `var(${name})`,
              height: 16,
              background: "var(--color-accent)",
            }}
          />
        </li>
      ))}
    </ul>
  );
}

const meta = {
  title: "デザイントークン",
  parameters: {
    docs: { disable: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** 色のトークン。上のツールバーでテーマ・アクセントカラー・コントラストを切り替えると追従する */
export const Colors: Story = {
  render: () => <ColorTokens />,
};

/** 文字サイズのトークン。ツールバーの文字サイズに追従する */
export const Text: Story = {
  render: () => <TextTokens />,
};

export const Space: Story = {
  render: () => <SpaceTokens />,
};
