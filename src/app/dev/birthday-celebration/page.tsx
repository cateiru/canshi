import { notFound } from "next/navigation";
import { BirthdayCelebrationPreview } from "./BirthdayCelebrationPreview";

/**
 * 猫の誕生日・毎月の記念日のお祝い（紙吹雪とモーダル）を、節目を選んで何度でも表示する開発用ページ。
 * 本物のお祝いは端末の今日が節目の日で、この端末でまだお祝いしていないときだけ開くため、
 * 日付や localStorage に関わらず見た目と文言を確かめられるようにする。本番では表示しない
 */
export default function BirthdayCelebrationDevPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <BirthdayCelebrationPreview />;
}
