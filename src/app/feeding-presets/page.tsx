import { TbPencil, TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { FeedingPresetIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { deleteFeedingPresetAction } from "@/features/feeding-presets/actions";
import { DeleteFeedingPresetButton } from "@/features/feeding-presets/DeleteFeedingPresetButton";
import { listFeedingPresets } from "@/features/feeding-presets/queries";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function FeedingPresetsPage() {
  const presets = await listFeedingPresets();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "ごはんプリセット一覧" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={FeedingPresetIcon}>
          ごはんプリセット一覧
        </RecordPageHeading>
        <ButtonLink href="/feeding-presets/new" variant="primary">
          <TbPlus aria-hidden="true" size={18} />
          プリセットを登録する
        </ButtonLink>
      </div>

      {presets.length === 0 ? (
        <Surface className={styles.emptyState}>
          <FeedingPresetIcon aria-hidden="true" size={32} />
          <p>まだプリセットが登録されていません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink href="/feeding-presets/new" variant="primary">
              最初のプリセットを登録する
            </ButtonLink>
          </div>
        </Surface>
      ) : (
        <ul className={styles.list}>
          {presets.map((preset) => (
            <li key={preset.id}>
              <article className={styles.preset} aria-label={preset.name}>
                <h2 className={styles.presetName}>{preset.name}</h2>
                <dl className={styles.details}>
                  {preset.items.map((item) => (
                    <div key={item.id} className={styles.product}>
                      <dt className={styles.productName}>
                        <FoodProductImage
                          name={item.foodProductName}
                          thumbnailUrl={item.foodProductImageUrl}
                        />
                        <span>{item.foodProductName}</span>
                      </dt>
                      <dd>
                        {item.givenAmountG}
                        <span>g</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/feeding-presets/${preset.id}/edit`}
                    variant="secondary"
                    className={styles.iconButton}
                    aria-label="編集する"
                    title="編集する"
                  >
                    <TbPencil aria-hidden="true" size={20} />
                  </ButtonLink>
                  <DeleteFeedingPresetButton
                    action={deleteFeedingPresetAction.bind(null, preset.id)}
                    presetName={preset.name}
                    className={styles.iconButton}
                  />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
