import { CAT_COAT_COLORS, type CatCoatColor } from "@/db/schema";
import { COAT_COLOR_LABEL } from "@/features/cats/domain/labels";
import { CatCoatIconScope } from "@/features/cats/presentation/CatCoatIconScope";
import { BcsIllustration } from "@/features/weight-records/presentation/BcsIllustration";
import {
  BCS_ILLUSTRATION_LAYERS,
  type BcsIllustrationName,
} from "@/features/weight-records/presentation/bcsIllustrationLayers";
import styles from "./page.module.css";

const NAMES = Object.keys(BCS_ILLUSTRATION_LAYERS) as BcsIllustrationName[];

const COATS: { label: string; coatColor: CatCoatColor | null }[] = [
  { label: "毛色が未設定", coatColor: null },
  ...CAT_COAT_COLORS.map((coatColor) => ({
    label: COAT_COLOR_LABEL[coatColor],
    coatColor,
  })),
];

/**
 * 体重記録の BCS のイラストをすべて、猫の毛色ごとに並べる開発用ページ。
 * 毛色の塗り・輪郭の色を、VRT（e2e/vrt.spec.ts）でライト・ダークテーマとも確かめる。
 * 本番では表示しない（`src/app/dev/layout.tsx`）
 */
export default function BcsIllustrationsDevPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>BCS のイラストの一覧</h1>
      {COATS.map(({ label, coatColor }) => (
        <section key={label} className={styles.section}>
          <h2 className={styles.heading}>{label}</h2>
          <CatCoatIconScope
            catId={`dev-bcs-${coatColor ?? "unset"}`}
            coatColor={coatColor}
          >
            <ul className={styles.grid}>
              {NAMES.map((name) => {
                const { width, height } = BCS_ILLUSTRATION_LAYERS[name];
                return (
                  <li key={name} className={styles.item}>
                    <BcsIllustration
                      name={name}
                      className={styles.illustration}
                      width={width / 8}
                      height={height / 8}
                    />
                    <span className={styles.name}>{name}</span>
                  </li>
                );
              })}
            </ul>
          </CatCoatIconScope>
        </section>
      ))}
    </main>
  );
}
