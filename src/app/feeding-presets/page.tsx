import { Fragment } from "react";
import { Breadcrumb, ButtonLink, Card } from "@/components/ui";
import { deleteFeedingPresetAction } from "@/features/feeding-presets/actions";
import { DeleteFeedingPresetButton } from "@/features/feeding-presets/DeleteFeedingPresetButton";
import { listFeedingPresets } from "@/features/feeding-presets/queries";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function FeedingPresetsPage() {
  const presets = await listFeedingPresets();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ごはんプリセット一覧" },
        ]}
      />

      <div className={styles.header}>
        <h1>ごはんプリセット一覧</h1>
        <ButtonLink href="/feeding-presets/new" variant="primary">
          プリセットを登録する
        </ButtonLink>
      </div>

      {presets.length === 0 ? (
        <Card>
          <p>まだプリセットが登録されていません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink href="/feeding-presets/new" variant="primary">
              最初のプリセットを登録する
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {presets.map((preset) => (
            <li key={preset.id}>
              <Card title={preset.name}>
                <dl className={styles.details}>
                  {preset.items.map((item) => (
                    <Fragment key={item.id}>
                      <dt className={styles.productName}>
                        <FoodProductImage
                          name={item.foodProductName}
                          thumbnailUrl={item.foodProductImageUrl}
                          size="sm"
                        />
                        {item.foodProductName}
                      </dt>
                      <dd>{item.givenAmountG} g</dd>
                    </Fragment>
                  ))}
                </dl>
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/feeding-presets/${preset.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteFeedingPresetButton
                    action={deleteFeedingPresetAction.bind(null, preset.id)}
                    presetName={preset.name}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
