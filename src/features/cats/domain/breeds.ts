export type CatBreed = {
  /** 日本語の表示名。猫種の入力欄に入り、そのまま保存される */
  name: string;
  /** TICA での英語名。英字入力でも候補に出すために使う */
  nameEn: string;
  /** 通称など、表示名以外で検索に使う名前 */
  aliases?: string[];
};

// 国際猫協会（TICA）の猫種一覧をもとにした候補。
// https://tica.org/ticas-breeds/browse-all-breeds/ （2026-09-22 時点）
// 年齢による区分である Household Pet Kitten は猫種ではないため含めず、
// Household Pet は日本で一般的な「ミックス（雑種）」として扱う。
const BREEDS: CatBreed[] = [
  { name: "アビシニアン", nameEn: "Abyssinian" },
  { name: "アメリカンボブテイル", nameEn: "American Bobtail" },
  {
    name: "アメリカンボブテイル・ショートヘア",
    nameEn: "American Bobtail Shorthair",
  },
  { name: "アメリカンカール", nameEn: "American Curl" },
  {
    name: "アメリカンカール・ロングヘア",
    nameEn: "American Curl Longhair",
  },
  {
    name: "アメリカンショートヘア",
    nameEn: "American Shorthair",
    aliases: ["アメショ"],
  },
  { name: "アメリカンワイヤーヘア", nameEn: "American Wirehair" },
  { name: "オーストラリアンミスト", nameEn: "Australian Mist" },
  { name: "バリニーズ", nameEn: "Balinese" },
  { name: "ベンガル", nameEn: "Bengal" },
  { name: "ベンガル・ロングヘア", nameEn: "Bengal Longhair" },
  { name: "バーマン", nameEn: "Birman" },
  { name: "ボンベイ", nameEn: "Bombay" },
  { name: "ブリティッシュロングヘア", nameEn: "British Longhair" },
  {
    name: "ブリティッシュショートヘア",
    nameEn: "British Shorthair",
    aliases: ["ブリショー"],
  },
  { name: "バーミーズ", nameEn: "Burmese" },
  { name: "バーミラ", nameEn: "Burmilla" },
  { name: "バーミラ・ロングヘア", nameEn: "Burmilla Longhair" },
  { name: "シャルトリュー", nameEn: "Chartreux" },
  { name: "チャウシー", nameEn: "Chausie" },
  { name: "ケルビム", nameEn: "Cherubim" },
  { name: "コーニッシュレックス", nameEn: "Cornish Rex" },
  { name: "キムリック", nameEn: "Cymric" },
  { name: "キムリック・テイルド", nameEn: "Cymric Tailed" },
  { name: "デボンレックス", nameEn: "Devon Rex" },
  { name: "ドンスコイ", nameEn: "Donskoy" },
  { name: "エジプシャンマウ", nameEn: "Egyptian Mau" },
  { name: "エキゾチックショートヘア", nameEn: "Exotic Shorthair" },
  { name: "ハバナ", nameEn: "Havana", aliases: ["ハバナブラウン"] },
  { name: "ハイランダー", nameEn: "Highlander" },
  {
    name: "ハイランダー・ショートヘア",
    nameEn: "Highlander Shorthair",
  },
  { name: "ヒマラヤン", nameEn: "Himalayan" },
  {
    name: "ミックス（雑種）",
    nameEn: "Household Pet",
    aliases: ["ハウスホールドペット", "ざっしゅ"],
  },
  { name: "ジャパニーズボブテイル", nameEn: "Japanese Bobtail" },
  {
    name: "ジャパニーズボブテイル・ロングヘア",
    nameEn: "Japanese Bobtail Longhair",
  },
  { name: "カオマニー", nameEn: "Khaomanee" },
  { name: "コラット", nameEn: "Korat" },
  { name: "クリリアンボブテイル", nameEn: "Kurilian Bobtail" },
  {
    name: "クリリアンボブテイル・ロングヘア",
    nameEn: "Kurilian Bobtail Longhair",
  },
  { name: "ラパーマ", nameEn: "LaPerm" },
  { name: "ラパーマ・ショートヘア", nameEn: "LaPerm Shorthair" },
  { name: "ライコイ", nameEn: "Lykoi" },
  { name: "メインクーン", nameEn: "Maine Coon" },
  {
    name: "メインクーン・ポリダクティル",
    nameEn: "Maine Coon Polydactyl",
  },
  { name: "マンクス", nameEn: "Manx" },
  { name: "マンクス・テイルド", nameEn: "Manx Tailed" },
  { name: "ミヌエット", nameEn: "Minuet" },
  { name: "ミヌエット・ロングヘア", nameEn: "Minuet Longhair" },
  { name: "ミヌエット・トール", nameEn: "Minuet Talls" },
  {
    name: "ミヌエット・トール・ロングヘア",
    nameEn: "Minuet Talls Longhair",
  },
  { name: "マンチカン", nameEn: "Munchkin" },
  { name: "マンチカン・ロングヘア", nameEn: "Munchkin Longhair" },
  { name: "ネベロング", nameEn: "Nebelung" },
  {
    name: "ノルウェージャンフォレストキャット",
    nameEn: "Norwegian Forest",
  },
  { name: "オシキャット", nameEn: "Ocicat" },
  { name: "オリエンタルロングヘア", nameEn: "Oriental Longhair" },
  { name: "オリエンタルショートヘア", nameEn: "Oriental Shorthair" },
  { name: "ペルシャ", nameEn: "Persian" },
  { name: "ピーターボールド", nameEn: "Peterbald" },
  { name: "ピクシーボブ", nameEn: "Pixiebob" },
  { name: "ピクシーボブ・ロングヘア", nameEn: "Pixiebob Longhair" },
  { name: "ラグドール", nameEn: "Ragdoll" },
  { name: "ロシアンブルー", nameEn: "Russian Blue" },
  { name: "サバンナ", nameEn: "Savannah" },
  { name: "スコティッシュフォールド", nameEn: "Scottish Fold" },
  {
    name: "スコティッシュフォールド・ロングヘア",
    nameEn: "Scottish Fold Longhair",
  },
  { name: "スコティッシュストレート", nameEn: "Scottish Straight" },
  {
    name: "スコティッシュストレート・ロングヘア",
    nameEn: "Scottish Straight Longhair",
  },
  { name: "セルカークレックス", nameEn: "Selkirk Rex" },
  {
    name: "セルカークレックス・ロングヘア",
    nameEn: "Selkirk Rex Longhair",
  },
  { name: "セレンゲティ", nameEn: "Serengeti" },
  { name: "シャム", nameEn: "Siamese", aliases: ["サイアミーズ"] },
  { name: "サイベリアン", nameEn: "Siberian" },
  { name: "シンガプーラ", nameEn: "Singapura" },
  { name: "スノーシュー", nameEn: "Snowshoe" },
  { name: "ソマリ", nameEn: "Somali" },
  { name: "スフィンクス", nameEn: "Sphynx" },
  { name: "テネシーレックス", nameEn: "Tennessee Rex" },
  { name: "タイ", nameEn: "Thai" },
  { name: "トンキニーズ", nameEn: "Tonkinese" },
  { name: "トイボブ", nameEn: "Toybob" },
  { name: "トイガー", nameEn: "Toyger" },
  { name: "ターキッシュアンゴラ", nameEn: "Turkish Angora" },
  { name: "ターキッシュバン", nameEn: "Turkish Van" },
];

const collator = new Intl.Collator("ja");

/** 五十音順に並べた猫種の候補 */
export const CAT_BREEDS: readonly CatBreed[] = [...BREEDS].sort((a, b) =>
  collator.compare(a.name, b.name),
);

const BREEDS_BY_NAME = new Map(CAT_BREEDS.map((breed) => [breed.name, breed]));

/**
 * 表記ゆれを吸収して比較できる形にする。
 * 全角・半角と大文字・小文字をそろえ、ひらがなをカタカナにし、
 * 区切りの空白・中点と長音記号（「ロングヘアー」と「ロングヘア」など）を取り除く。
 */
export function normalizeBreedText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) + 0x60),
    )
    .replace(/[\s・ー-]/g, "");
}

/**
 * 猫種の候補 `name` が入力 `inputValue` に当てはまるか。
 * 日本語名・英語名・通称のいずれかに入力が含まれていれば候補として出す。
 */
export function matchesBreed(name: string, inputValue: string): boolean {
  const query = normalizeBreedText(inputValue);
  if (query === "") return true;

  const breed = BREEDS_BY_NAME.get(name);
  const candidates = [name, breed?.nameEn ?? "", ...(breed?.aliases ?? [])];
  return candidates.some((candidate) =>
    normalizeBreedText(candidate).includes(query),
  );
}
