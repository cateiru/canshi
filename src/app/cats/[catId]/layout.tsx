import { requireCatAccess } from "@/features/auth/presentation/session";
import { CatCoatIconScope } from "@/features/cats/presentation/CatCoatIconScope";

type CatLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ catId: string }>;
};

/**
 * `/cats/[catId]` 配下のページはすべて、ログイン中のユーザーの家の猫でなければ
 * 404 にする。Server Action はこのレイアウトを経由せずに呼べるため、各アクションでも
 * 個別に `requireCatAccess` を呼ぶ。
 * 配下のページのイラストアイコンの猫は、この猫の毛色で塗る（毛色を変えたら更新のアクションで
 * このレイアウトも描き直す）
 */
export default async function CatLayout({ children, params }: CatLayoutProps) {
  const { catId } = await params;
  const { cat } = await requireCatAccess(catId);
  return (
    <CatCoatIconScope catId={cat.id} coatColor={cat.coatColor}>
      {children}
    </CatCoatIconScope>
  );
}
