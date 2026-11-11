import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import * as RecordIcons from "@/components/ui/RecordIcons/RecordIcons";
import { CAT_COAT_COLORS, type CatCoatColor } from "@/db/schema";
import { COAT_COLOR_LABEL } from "@/features/cats/domain/labels";
import { CatCoatIconScope } from "@/features/cats/presentation/CatCoatIconScope";
import styles from "./page.module.css";

/** RecordIcons から書き出しているアイコン（名前が Icon で終わるコンポーネント）をすべて、名前順に並べる */
const ICONS = Object.entries(RecordIcons as Record<string, unknown>)
  .filter(
    (entry): entry is [string, ComponentType<RecordIcons.RecordIconProps>] =>
      entry[0].endsWith("Icon") && typeof entry[1] === "function",
  )
  .sort(([a], [b]) => a.localeCompare(b));

const COATS: { label: string; coatColor: CatCoatColor | null }[] = [
  { label: "毛色が未設定", coatColor: null },
  ...CAT_COAT_COLORS.map((coatColor) => ({
    label: COAT_COLOR_LABEL[coatColor],
    coatColor,
  })),
];

function IconGrid({ monochrome = false }: { monochrome?: boolean }) {
  return (
    <ul className={styles.grid}>
      {ICONS.map(([name, Icon]) => (
        <li key={name} className={styles.item}>
          <Icon
            className={styles.icon}
            aria-hidden="true"
            monochrome={monochrome}
          />
          <span className={styles.name}>{name.replace(/Icon$/, "")}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * イラストアイコン（RecordIcons）をすべて、猫の毛色ごとと単色表示で並べる開発用ページ。
 * 毛色の塗り・黒系の目・口・輪郭の色を、VRT（e2e/vrt.spec.ts）でライト・ダークテーマとも確かめる。
 * 本番では表示しない
 */
export default function RecordIconsDevPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>イラストアイコンの一覧</h1>
      {COATS.map(({ label, coatColor }) => (
        <section key={label} className={styles.section}>
          <h2 className={styles.heading}>{label}</h2>
          <CatCoatIconScope
            catId={`dev-${coatColor ?? "unset"}`}
            coatColor={coatColor}
          >
            <IconGrid />
          </CatCoatIconScope>
        </section>
      ))}
      <section className={styles.section}>
        <h2 className={styles.heading}>単色表示</h2>
        <IconGrid monochrome />
      </section>
    </main>
  );
}
