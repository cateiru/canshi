import type { Metadata } from "next";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HouseholdRelationDiagram } from "@/features/help/HouseholdRelationDiagram";
import { getHelpTopic } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";

const SLUG = "households-and-cats";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

export default function HouseholdsAndCatsHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <p>
          CANSHI
          では、いっしょにねこのお世話をする家族を「家」としてまとめ、ねこの記録を家のメンバーで共有します。はじめに家を作り、その家にねこを登録してから記録をはじめます。
        </p>
      }
      related={["create-household", "add-cat", "records"]}
    >
      <Surface title="家・ねこ・記録の関係" gap="md">
        <HouseholdRelationDiagram />
        <dl className={styles.terms}>
          <div>
            <dt>家</dt>
            <dd>
              ねこのお世話をする人の集まりです。家を作った人が「オーナー」になり、招待した家族は「メンバー」として参加します。1人で使う場合も、家を1つ作ります。
            </dd>
          </div>
          <div>
            <dt>ねこ</dt>
            <dd>
              ねこは、どれか1つの家に登録します。同じ家のメンバーは全員、その家のねこの記録を見たり追加したりできます。登録した後で、ねこの家を変えることはできません。
            </dd>
          </div>
          <div>
            <dt>記録</dt>
            <dd>
              ごはん・うんち・体重などの記録は、ねこごとにつけます。だれが記録したかも残るため、家族で分担してお世話をしていても、あとから確認できます。
            </dd>
          </div>
        </dl>
      </Surface>

      <Surface title="家ごとに共有するもの" gap="md">
        <p>
          次のものはねこごとではなく家ごとに登録し、家のメンバー全員で使います。
        </p>
        <ul className={styles.points}>
          <li>ごはん商品（ごはんの記録に使う商品）</li>
          <li>ごはんプリセット（よくあげるごはんの組み合わせ）</li>
          <li>ごはんの時間（ごはんのお知らせの時間）</li>
          <li>支出記録（ごはん代や病院代など）</li>
        </ul>
      </Surface>

      <Surface title="オーナーとメンバーの違い" gap="md">
        <ul className={styles.points}>
          <li>
            オーナーとメンバーのどちらも、家のねこの記録を見たり追加したりできます。
          </li>
          <li>
            家の名前の変更、家族の招待、メンバーを外す、家の削除ができるのはオーナーだけです。
          </li>
          <li>
            オーナーは家から抜けられません。抜けたいときは、先にほかのメンバーをオーナーにしてください。
          </li>
        </ul>
      </Surface>

      <Surface title="複数の家に入ることもできます" gap="md">
        <p>
          実家のねこと自分の家のねこを分けて記録したいときなど、1人で複数の家に所属できます。ねこ一覧では、家ごとにまとめてねこを表示します。
        </p>
      </Surface>
    </HelpArticle>
  );
}
