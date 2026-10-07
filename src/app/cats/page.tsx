import Link from "next/link";
import { TbPlus } from "react-icons/tb";
import { Badge, Breadcrumb, ButtonLink, Collapsible } from "@/components/ui";
import type { Cat } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import {
  calculateAge,
  calculateTimeSinceAdoption,
  formatAge,
  formatTimeSinceAdoption,
} from "@/features/cats/age";
import { BirthdayCelebration } from "@/features/cats/BirthdayCelebration";
import { toBirthdayCelebrationCat } from "@/features/cats/birthday";
import { CatAvatar } from "@/features/cats/CatAvatar";
import { CatIcon } from "@/features/cats/CatIcon";
import { SEX_LABEL } from "@/features/cats/labels";
import { groupCatsByHousehold } from "@/features/households/groupCats";
import {
  listCatsForUser,
  listHouseholdsForUser,
} from "@/features/households/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/** 家ごとの開閉状態を保存する localStorage のキー */
function householdExpandedStorageKey(householdId: string) {
  return `canshi:cats-household-expanded:${householdId}`;
}

function CatCardList({ catList }: { catList: Cat[] }) {
  return (
    <ul className={styles.householdCats}>
      {catList.map((cat) => {
        const timeSinceAdoption = cat.adoptedAt
          ? calculateTimeSinceAdoption(cat.adoptedAt)
          : null;

        return (
          <li key={cat.id}>
            <Link href={`/cats/${cat.id}`} className={styles.cardLink}>
              <Surface className={styles.catCard}>
                <div className={styles.cardBody}>
                  <CatAvatar
                    name={cat.name}
                    profileMediaAssetId={cat.profileMediaAssetId}
                  />
                  <div>
                    <h3 className={styles.catName}>{cat.name}</h3>
                    <Badge>{SEX_LABEL[cat.sex]}</Badge>
                    {cat.birthDate ? (
                      <p>{formatAge(calculateAge(cat.birthDate))}</p>
                    ) : null}
                    {timeSinceAdoption ? (
                      <p>
                        お迎えから
                        {formatTimeSinceAdoption(timeSinceAdoption)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Surface>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default async function CatsPage() {
  const user = await requireUser();
  const [householdList, catList] = await Promise.all([
    listHouseholdsForUser(user.id),
    listCatsForUser(user.id),
  ]);
  const groups = groupCatsByHousehold(householdList, catList);

  return (
    <main className={styles.main}>
      <BirthdayCelebration cats={catList.map(toBirthdayCelebrationCat)} />
      <Breadcrumb
        items={[{ label: "トップ", href: "/home" }, { label: "猫一覧" }]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={CatIcon}>猫一覧</RecordPageHeading>
        <ButtonLink href="/cats/new" variant="primary" leftIcon={TbPlus}>
          猫を登録する
        </ButtonLink>
      </div>

      {groups.length === 0 ? (
        <Surface className={styles.emptyState}>
          <CatIcon aria-hidden="true" size={32} />
          <p>所属している家がありません。</p>
          <p>
            猫を登録するには家が必要です。管理者に家の作成を依頼してください。
          </p>
        </Surface>
      ) : (
        <div className={styles.households}>
          {groups.map(({ household, cats }) => (
            <Collapsible
              key={household.id}
              title={household.name}
              titleAside={`${cats.length}匹`}
              storageKey={householdExpandedStorageKey(household.id)}
            >
              {cats.length === 0 ? (
                <div className={styles.householdEmpty}>
                  <p>この家にはまだ猫が登録されていません。</p>
                  {/* 登録画面でこの家を最初から選んでおく */}
                  <ButtonLink
                    href={`/cats/new?householdId=${encodeURIComponent(household.id)}`}
                    variant="primary"
                  >
                    最初の猫を登録する
                  </ButtonLink>
                </div>
              ) : (
                <CatCardList catList={cats} />
              )}
            </Collapsible>
          ))}
        </div>
      )}
    </main>
  );
}
