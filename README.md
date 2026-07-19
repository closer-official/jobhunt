# 企業リサーチ

企業発見、企業研究、ES、面接準備をつなぐ、
就活生向けのWebアプリです。

初期提供形態は、Webアプリです。

Chrome拡張は、初期公開から外しています。

## ローカル起動

```bash
npm install
npm run build
npm run dev
```

`npm run build`は、`web-dist/`を生成します。

Vercelも、`web-dist/`を公開対象にします。

## ローカル検証

```bash
npm test
npm run verify
```

テストは、保存済みフィクスチャだけを使います。

外部サイト、Firebase、Stripe、AIへ接続しません。

## 初期Webアプリ

- ホーム
- 企業名入力とローカル調査下書き
- 履歴書、職務経歴書、ES、面接準備の入口
- 無料版と三つの有料候補
- 認証と外部接続の状態表示

現在の画面は、ローカル試作です。

実検索、実保存、実決済、実AIは未接続です。

## Chrome拡張の保留コード

既存の拡張コードは、削除していません。

将来の再検討用として、別ビルドに残しています。

```bash
npm run build:extension
npm run dev:extension
```

拡張成果物は、`dist/`へ生成されます。

Vercelは、`dist/`を配信しません。

## 外部基盤

Firebaseは、初期保存先として設計しています。

共有企業と学生データは、別領域へ保存します。

実Firebaseへの接続と書込みは、未実施です。

Stripeは、有料版の決済候補です。

実商品、実決済、Webhookは、未設定です。

## Vercel

`vercel.json`は、次の設定です。

- Build Command: `npm run build`
- Output Directory: `web-dist`

GitHubへ反映後、Vercelの次回ビルドから有効です。

このリポジトリからの実デプロイは行っていません。
