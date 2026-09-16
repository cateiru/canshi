---
name: skill-creation
description: このリポジトリで Codex/Claude 向けの新しい skill を作成・改修するときの手順とベストプラクティスをまとめる。「skill を作って」「新しい skill を追加して」と言われたとき、または既存 skill を修正するときに使う。
metadata:
  short-description: 新しい skill を .codex/skills 配下に作成し .claude/skills へシンボリックリンクする手順とベストプラクティスをまとめる
---

# skill を作成する

このリポジトリの skill は Codex 向けに実体を置き、Claude 向けはシンボリックリンクで
共有する。新しい skill を作る、または既存の skill を直す際はこのファイルに従う。

## ディレクトリ構成（必須）

- 実体は必ず `.codex/skills/<skill-name>/SKILL.md` に置く。
- `.claude/skills/<skill-name>` はディレクトリシンボリックリンクとして作成し、
  `.codex/skills/<skill-name>` を指す（[`version-bump`](../version-bump/SKILL.md)
  が既存の実例）。

```sh
mkdir -p .codex/skills/<skill-name>
# SKILL.md や補助ファイルを .codex/skills/<skill-name>/ に書く
ln -s ../../.codex/skills/<skill-name> .claude/skills/<skill-name>
```

- 補助ファイル（`reference.md` や `scripts/` など）を追加する場合も、実体は
  `.codex/skills/<skill-name>/` 配下に置く。Claude 側はディレクトリごと
  シンボリックリンクされているため、追加のリンク作業は不要。

## SKILL.md のフロントマター

```yaml
---
name: <kebab-case の skill 名>
description: 何をする skill で、いつ使うべきかを一文で書く。トリガーとなる
  ユーザーの発言例も含める。
metadata:
  short-description: 一覧表示用の短い説明（日本語で1文）
---
```

- `name` は英小文字・数字・ハイフンのみ。ディレクトリ名と一致させる。
- 命名は `version-bump` / `skill-creation` のような**名詞句**で統一する
  （動名詞形など別の流儀と混在させない）。
- `description` は三人称で、「何をするか」と「いつ使うか」の両方を書く
  （例: 「〜を判断し、更新する。〜と言われたときに使う。」）。曖昧な説明
  （「ヘルパー」「ユーティリティ」など）は避ける。

## 本文を書く上でのベストプラクティス

- **簡潔にする。** Claude/Codex はすでに賢い。説明文が既知の前提を長々と
  書き直していないか確認する。1つの判断につき数行で十分なことが多い。
- **自由度をタスクに合わせる。** 手順が1通りしかなく間違えると危険な作業
  （DB マイグレーション等）は具体的なコマンドをそのまま書く。判断の余地が
  ある作業（コードレビューの観点等）は方針・基準だけを箇条書きにする。
- **本文は目安500行以内に収める。** 超えそうなら `reference.md` などの
  別ファイルに分割し、SKILL.md からリンクする。ただし参照は
  **SKILL.md から1階層だけ**にする（別ファイルからさらに別ファイルを
  参照する多段リンクは避ける。孫参照は読み飛ばされやすい）。
- **用語を統一する。** 同じ概念に複数の呼び方を混在させない。
- **選択肢を絞る。** 「A でも B でも C でもよい」ではなく、デフォルトの
  やり方を1つ示し、例外時の代替案だけ添える。
- **時期依存の情報を避ける。** 「◯月以降は新しいやり方で」のような記述は
  すぐ陳腐化する。現行のやり方だけを書き、旧仕様が必要なら「旧パターン」
  として明示的に分ける。
- **複雑な手順にはチェックリストを使う。** 複数ステップに分かれる作業は
  番号付き手順やチェックリスト形式にし、検証（テスト実行など）を各ステップ
  に組み込む。

## このリポジトリ固有のルール

- skill 内で他のドキュメントを参照する際は、**その SKILL.md 自身が置かれた
  ディレクトリ（`.codex/skills/<skill-name>/`）からの相対パス**でリンクする
  （例: このファイルから見た `AGENTS.md` は `../../../AGENTS.md`）。
- **AGENTS.md に使い方を追記する（必須）。** 新しい skill を追加したら、
  `AGENTS.md` に節を追加し、どんな場面でその skill を使うべきか・
  実体とシンボリックリンクの関係を短く説明する（[`version-bump` の節](../../../AGENTS.md)
  が既存の書き方の実例）。
- skill 追加自体はユーザーに見える機能変更ではないため、リリースノート
  （`src/features/release-notes/release-notes.json`）やバージョンアップは
  不要。ただし、その skill が指示する作業（例: バージョンアップ）が
  実際にユーザー向けの変更を伴う場合は、通常どおりリリースノートの
  ルールに従う。

## 作成後のチェックリスト

- [ ] `description` に「何をするか」と「いつ使うか」の両方が書かれている
- [ ] SKILL.md 本文が簡潔で、自明な前提の説明を書きすぎていない
- [ ] `.claude/skills/<skill-name>` が `.codex/skills/<skill-name>` への
      ディレクトリシンボリックリンクになっている
- [ ] `AGENTS.md` にこの skill の使い方を追記した
- [ ] 手順・コマンド例が実際に動作する内容になっている

## 参考

- [Skill authoring best practices（Anthropic 公式ドキュメント）](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Agent Skills overview（Anthropic 公式ドキュメント）](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
