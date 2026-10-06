import { requireCatAccess } from "@/features/auth/session";

type CatLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ catId: string }>;
};

/**
 * `/cats/[catId]` 配下のページはすべて、ログイン中のユーザーの家の猫でなければ
 * 404 にする。Server Action はこのレイアウトを経由せずに呼べるため、各アクションでも
 * 個別に `requireCatAccess` を呼ぶ
 */
export default async function CatLayout({ children, params }: CatLayoutProps) {
  const { catId } = await params;
  await requireCatAccess(catId);
  return children;
}
