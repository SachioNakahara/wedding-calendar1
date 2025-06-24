<div align="center">
  <h1>ウエディングカレンダー連携バックエンド</h1>
  <p>Google Calendar と連携するウエディングカレンダーアプリケーションのバックエンドAPI</p>
</div>

---

## 概要

このプロジェクトは、ウエディングカレンダーアプリケーションのバックエンド API を提供します。Google Calendar API を利用して、イベントの取得、作成、更新、削除、そして双方向の同期機能を実現しています。認証には Google OAuth2 を使用し、セッション管理も行っています。

## 機能

- **Google OAuth2 認証**: ユーザーの Google アカウントを安全に認証し、Google Calendar へのアクセス権を取得します。
- **カレンダー一覧取得**: 認証済みユーザーの Google カレンダー一覧を取得します。
- **イベント管理**:
  - Google Calendar からイベントを取得
  - Google Calendar にイベントを作成
  - Google Calendar のイベントを更新
  - Google Calendar のイベントを削除
- **双方向同期**: ウエディングカレンダーのイベントと Google Calendar のイベントを同期します。
- **セッション管理**: `express-session` を使用したセッションベースの認証状態管理。
- **環境変数管理**: `dotenv` を使用して機密情報を安全に管理。
- **ヘルスチェック**: API の稼働状況を確認するためのエンドポイント。

## セットアップ

### 1. プロジェクトのクローン

```bash
git clone <あなたのGitHubリポジトリURL>
cd wedding-calendar-backend # またはあなたのプロジェクトのルートディレクトリ
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

プロジェクトのルートディレクトリ (`backend` フォルダ) に `.env` ファイルを作成し、以下の内容を記述してください。これらの値は Google Cloud Console で取得する必要があります。

```
PORT=3000
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:3000 # またはあなたのフロントエンドのURL
CLIENT_ORIGIN=http://localhost:3000 # またはあなたのフロントエンドのURL
SESSION_SECRET=YOUR_RANDOM_SESSION_SECRET # 強固なランダムな文字列を設定してください
```

**注意**: `GOOGLE_REDIRECT_URI` は、Google Cloud Console で設定した OAuth 2.0 クライアント ID の承認済みリダイレクト URI と一致させる必要があります。

### 4. サーバーの起動

開発モードでサーバーを起動します (ファイルの変更を監視し、自動で再起動します)。

```bash
npm run dev
```

本番環境でサーバーを起動する場合は:

```bash
npm start
```

## API エンドポイント

`server.js` で定義されている主な API エンドポイントは以下の通りです。

- `GET /auth/google`: Google OAuth2 認証 URL を生成
- `GET /auth/callback`: Google OAuth2 コールバック処理
- `GET /auth/status`: 認証状態の確認
- `POST /auth/logout`: ログアウト
- `GET /api/calendars`: Google Calendar のカレンダー一覧を取得
- `GET /api/events`: Google Calendar のイベント一覧を取得
- `POST /api/events`: Google Calendar にイベントを作成
- `PUT /api/events/:eventId`: Google Calendar のイベントを更新
- `DELETE /api/events/:eventId`: Google Calendar のイベントを削除
- `POST /api/sync`: ウエディングカレンダーと Google Calendar のイベントを同期
- `GET /api/config`: API 設定情報を取得
- `GET /health`: ヘルスチェック

## 使用技術

- Node.js
- Express.js
- Google APIs Node.js Client (`googleapis`)
- `dotenv`
- `express-session`
- `cors`
- `nodemon` (開発用)

## 貢献

貢献を歓迎します！バグ報告や機能追加の提案は、GitHub の Issues をご利用ください。

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
