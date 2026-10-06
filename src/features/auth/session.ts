import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import {
  getCatForUser,
  getHouseholdForUser,
  listCatsForUser,
} from "@/features/households/queries";
import { getSessionUser } from "./sessions";
import { SESSION_COOKIE_NAME } from "./sessionToken";

/**
 * Cookie のセッショントークンからログイン中のユーザーを返す。Cookie がない場合に加え、
 * セッションが DB に存在しない・期限切れの場合（ログアウト済み、ローカル DB を
 * 作り直したあとの古い Cookie など）も null を返す。
 * レイアウトとページの両方から呼ばれるため、1 回のリクエストの中では結果を使い回す
 */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return getSessionUser(token);
});

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

/**
 * ログイン中のユーザーが所属する家であることを確認し、ユーザーと家（家での権限を含む）を返す。
 * 存在しない家・所属していない家は区別せず 404 にする
 */
export async function requireHouseholdAccess(householdId: string) {
  const user = await requireUser();
  const household = await getHouseholdForUser(user.id, householdId);
  if (!household) {
    notFound();
  }
  return { user, household };
}

/**
 * ログイン中のユーザーが参照できる猫であれば返す。存在しない・別の家の猫なら null。
 * `/cats/[catId]` 配下のページはレイアウトでも確認しているが、レイアウトは画面遷移の
 * たびに再実行されるとは限らないため、ページ自身もこれで猫を取得する
 */
export async function getAccessibleCat(catId: string) {
  const user = await requireUser();
  return getCatForUser(user.id, catId);
}

/** ログイン中のユーザーが参照できる猫（所属する家の猫）の一覧。新しく登録した順 */
export async function listCurrentUserCats() {
  const user = await requireUser();
  return listCatsForUser(user.id);
}
