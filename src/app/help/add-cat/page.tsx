import type { Metadata } from "next";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpSteps } from "@/features/help/HelpSteps";
import { getHelpTopic } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";

const SLUG = "add-cat";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

export default function AddCatHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <p>
          家を作ったら、ねこを登録しましょう。登録したねこは、同じ家のメンバー全員で記録を共有します。
        </p>
      }
      related={["create-household", "records", "notifications"]}
    >
      <Surface title="ねこを登録する" gap="md">
        <HelpSteps
          steps={[
            {
              title: "ねこ一覧の「追加する」から「ねこを登録する」を選びます",
              body: <p>家がまだないときは、先に家を作成してください。</p>,
            },
            {
              title: "名前などを入力して「登録する」を押します",
              body: (
                <>
                  <p>
                    入力が必要なのは名前だけです。ほかの項目はわかるものだけ入力すれば大丈夫で、あとから変更できます。
                  </p>
                  <p>
                    複数の家に所属しているときは、「家」でどの家のねこにするかを選びます。登録した後は、家を変えられません。
                  </p>
                </>
              ),
              screenshot: {
                name: "cat-new",
                alt: "ねこを登録する画面。名前・性別・猫種・家の入力欄が並んでいる",
              },
            },
            {
              title: "登録したねこの画面から、記録をはじめます",
              body: (
                <p>
                  ねこの画面には、ごはん・うんち・体重などの記録の入り口が並んでいます。
                </p>
              ),
              screenshot: {
                name: "cat-detail",
                alt: "ねこの画面。基本情報と、記録の種類ごとのボタンが並んでいる",
              },
            },
          ]}
        />
      </Surface>

      <Surface title="登録できる内容" gap="md">
        <dl className={styles.terms}>
          <div>
            <dt>基本情報</dt>
            <dd>名前・性別・避妊／去勢・猫種・家を登録します。</dd>
          </div>
          <div>
            <dt>毛色</dt>
            <dd>
              近い毛色を選ぶと、ねこの画面に表示するイラストがその毛色になります。わからない場合は未設定のままで大丈夫です。
            </dd>
          </div>
          <div>
            <dt>大切な日</dt>
            <dd>
              誕生日とお迎え日です。誕生日は、年や月だけがわかる場合も登録できます。誕生日を登録すると、年齢の表示や誕生日のお知らせに使われます。
            </dd>
          </div>
          <div>
            <dt>プロフィール画像</dt>
            <dd>
              登録した後、ねこの画面の編集から設定できます。画像を選ぶと、正方形に切り抜く範囲を調整できます。
            </dd>
          </div>
        </dl>
      </Surface>

      <Surface title="メモリーについて" gap="md">
        <p>
          旅立ったねこは、ねこの編集画面から「メモリー」へ移せます。メモリーへ移すと記録の追加やお知らせが止まり、これまでの記録を思い出として見返せます。メモリーから戻すこともできます。
        </p>
      </Surface>
    </HelpArticle>
  );
}
