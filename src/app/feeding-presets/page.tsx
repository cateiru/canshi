import { TbPencil, TbPlus } from "react-icons/tb";
import { Badge, Breadcrumb, ButtonLink, IconButtonLink } from "@/components/ui";
import { FeedingPresetIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { deleteFeedingPresetAction } from "@/features/feeding-presets/actions";
import { DeleteFeedingPresetButton } from "@/features/feeding-presets/DeleteFeedingPresetButton";
import { listFeedingPresetsForUser } from "@/features/feeding-presets/queries";
import {
  FEEDING_MODE_LABEL,
  GIVEN_AMOUNT_LEVEL_LABEL,
} from "@/features/feeding-records/labels";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import { groupByHousehold } from "@/features/households/groupCats";
import { HouseholdSections } from "@/features/households/HouseholdSections";
import { listHouseholdsForUser } from "@/features/households/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/** 家ごとの開閉状態を保存する localStorage のキー */
function householdExpandedStorageKey(householdId: string) {
  return `canshi:feeding-presets-household-expanded:${householdId}`;
}

export default async function FeedingPresetsPage() {
  const user = await requireUser();
  const [householdList, presets] = await Promise.all([
    listHouseholdsForUser(user.id),
    listFeedingPresetsForUser(user.id),
  ]);
  const groups = groupByHousehold(householdList, presets);

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
        <ButtonLink
          href="/feeding-presets/new"
          variant="primary"
          leftIcon={TbPlus}
        >
          プリセットを登録する
        </ButtonLink>
      </div>

      {groups.length === 0 ? (
        <Surface className={styles.emptyState}>
          <FeedingPresetIcon aria-hidden="true" size={32} />
          <p>所属している家がありません。</p>
          <p>
            プリセットを登録するには家が必要です。管理者に家の作成を依頼してください。
          </p>
        </Surface>
      ) : (
        <HouseholdSections
          groups={groups}
          storageKey={householdExpandedStorageKey}
          countLabel={(count) => `${count}件`}
          className={styles.households}
        >
          {({ household, items }) =>
            items.length === 0 ? (
              <Surface className={styles.emptyState}>
                <FeedingPresetIcon aria-hidden="true" size={32} />
                <p>まだプリセットが登録されていません。</p>
                <div className={styles.emptyActions}>
                  {/* 登録画面でこの家を最初から選んでおく */}
                  <ButtonLink
                    href={`/feeding-presets/new?householdId=${encodeURIComponent(household.id)}`}
                    variant="primary"
                  >
                    最初のプリセットを登録する
                  </ButtonLink>
                </div>
              </Surface>
            ) : (
              <ul className={styles.list}>
                {items.map((preset) => (
                  <li key={preset.id}>
                    <article className={styles.preset} aria-label={preset.name}>
                      <div className={styles.presetHeader}>
                        <h2 className={styles.presetName}>{preset.name}</h2>
                        {preset.mode === "approximate" ? (
                          <Badge color="info">
                            {FEEDING_MODE_LABEL[preset.mode]}
                          </Badge>
                        ) : null}
                      </div>
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
                              {preset.mode === "approximate" ? (
                                item.givenAmountLevel ? (
                                  GIVEN_AMOUNT_LEVEL_LABEL[
                                    item.givenAmountLevel
                                  ]
                                ) : (
                                  "-"
                                )
                              ) : (
                                <>
                                  {item.givenAmountG}
                                  <span>g</span>
                                </>
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <div className={styles.cardActions}>
                        <IconButtonLink
                          href={`/feeding-presets/${preset.id}/edit`}
                          icon={TbPencil}
                          aria-label="編集する"
                          title="編集する"
                        />
                        <DeleteFeedingPresetButton
                          action={deleteFeedingPresetAction.bind(
                            null,
                            preset.id,
                          )}
                          presetName={preset.name}
                        />
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )
          }
        </HouseholdSections>
      )}
    </main>
  );
}
