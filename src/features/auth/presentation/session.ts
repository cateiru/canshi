import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { isMemorialCat } from "@/features/cats/domain/memorial";
import {
  getCatForUser,
  getHouseholdForUser,
  listCatsForUser,
} from "@/features/households/infrastructure/queries";
import { SESSION_COOKIE_NAME } from "../domain/sessionToken";
import { getSessionUser } from "../infrastructure/sessions";

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
 * `requireCatAccess` に加えて、記録・プロフィール・通知の設定を変えられる猫（メモリーへ移していない猫）で
 * あることを確認する。メモリーへ移した猫なら、猫のページへ移動する。記録や設定を書き換える
 * Server Action は、`requireCatAccess` ではなくこれを通す（メモリーへ移す・戻す、猫の削除は除く）
 */
export async function requireWritableCatAccess(catId: string) {
  const access = await requireCatAccess(catId);
  if (isMemorialCat(access.cat)) {
    redirectFromMemorialCat(catId);
  }
  return access;
}

/**
 * メモリーへ移した猫の記録を書き換えようとしたときに、猫のページへ移動する。`requireWritableCatAccess` の
 * 確認の後、書き込みの前に猫がメモリーへ移され、書き込みが文の中で断られたとき（追加の ID が null など）にも使う
 */
export function redirectFromMemorialCat(catId: string): never {
  redirect(`/cats/${catId}`);
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
 * たびに再実行されるとは限らないため、ページ自身もこれで猫を取得する。
 * ページと title（`generateMetadata`）の両方から呼ばれるため、1 回のリクエストの中では結果を使い回す
 */
export const getAccessibleCat = cache(async (catId: string) => {
  const user = await requireUser();
  return getCatForUser(user.id, catId);
});

/**
 * `getAccessibleCat` の、記録を追加・編集するページ向け。メモリーへ移した猫も null にする
 * （ページは 404 にする。メモリーへ移した猫のページからは、追加・編集の導線を出さない）
 */
export async function getWritableCat(catId: string) {
  const cat = await getAccessibleCat(catId);
  return cat && !isMemorialCat(cat) ? cat : null;
}

/** ログイン中のユーザーが参照できる猫（所属する家の猫）の一覧。新しく登録した順 */
export async function listCurrentUserCats() {
  const user = await requireUser();
  return listCatsForUser(user.id);
}
