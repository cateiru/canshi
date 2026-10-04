import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCatForUser, listCatsForUser } from "@/features/households/queries";
import { getUserById } from "./users";

/**
 * Cookie のセッションからログイン中のユーザーを返す。セッションがない場合に加え、
 * セッションのユーザーが DB に存在しない場合（ローカル DB を作り直したあとの古い
 * Cookie など）も null を返す
 */
export async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }
  return getUserById(userId);
}

/**
 * ログイン中のユーザーを返す。ログインしていなければ `/login` へリダイレクトする。
 * middleware でもセッションの有無を確認しているが、Server Action はどのパスへの
 * POST からでも呼べてしまうため、ページ・アクションの側でも必ずこれを通す
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * ログイン中のユーザーが参照できる猫であることを確認し、ユーザーと猫を返す。
 * 存在しない猫・別の家の猫は区別せず 404 にする
 */
export async function requireCatAccess(catId: string) {
  const user = await requireUser();
  const cat = await getCatForUser(user.id, catId);
  if (!cat) {
    notFound();
  }
  return { user, cat };
}

/** ログイン中のユーザーが参照できる猫（所属する家の猫）の一覧。新しく登録した順 */
export async function listCurrentUserCats() {
  const user = await requireUser();
  return listCatsForUser(user.id);
}
