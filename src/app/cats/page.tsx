import Link from "next/link";
import { TbPlus } from "react-icons/tb";
import { Badge, Breadcrumb, ButtonLink } from "@/components/ui";
import {
  calculateAge,
  calculateDaysSinceAdoption,
  formatAge,
} from "@/features/cats/age";
import { CatAvatar } from "@/features/cats/CatAvatar";
import { CatIcon } from "@/features/cats/CatIcon";
import { SEX_LABEL } from "@/features/cats/labels";
import { listCats } from "@/features/cats/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function CatsPage() {
  const catList = await listCats();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/home" }, { label: "猫一覧" }]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={CatIcon}>猫一覧</RecordPageHeading>
        <ButtonLink href="/cats/new" variant="primary">
          <TbPlus aria-hidden="true" size={18} />
          猫を登録する
        </ButtonLink>
      </div>

      {catList.length === 0 ? (
        <Surface className={styles.emptyState}>
          <CatIcon aria-hidden="true" size={32} />
          <p>まだ猫が登録されていません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink href="/cats/new" variant="primary">
              最初の猫を登録する
            </ButtonLink>
          </div>
        </Surface>
      ) : (
        <ul className={styles.list}>
          {catList.map((cat) => (
            <li key={cat.id}>
              <Link href={`/cats/${cat.id}`} className={styles.cardLink}>
                <Surface>
                  <div className={styles.cardBody}>
                    <CatAvatar
                      name={cat.name}
                      profileMediaAssetId={cat.profileMediaAssetId}
                      profileCropX={cat.profileCropX}
                      profileCropY={cat.profileCropY}
                    />
                    <div>
                      <h2 className={styles.catName}>{cat.name}</h2>
                      <Badge>{SEX_LABEL[cat.sex]}</Badge>
                      {cat.birthDate ? (
                        <p>{formatAge(calculateAge(cat.birthDate))}</p>
                      ) : null}
                      {cat.adoptedAt ? (
                        <p>
                          お迎えから{calculateDaysSinceAdoption(cat.adoptedAt)}
                          日
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Surface>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
