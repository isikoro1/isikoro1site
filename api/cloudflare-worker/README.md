# isikoro.dev API draft

Cloudflare Workers + D1 で、アプリ詳細ページのリアクション機能を動かすための最小API案です。

## できること

- アプリ情報の取得
- 管理者トークン付きのアプリ作成・更新・削除
- 表示数、いいね数、共有数の記録
- コメント投稿と取得
- 30日間のイベント数に基づくランキング取得

## 想定エンドポイント

- `GET /apps`
- `GET /apps/:id`
- `GET /apps/:id/stats`
- `POST /apps/:id/impressions`
- `POST /apps/:id/likes`
- `POST /apps/:id/shares`
- `GET /apps/:id/comments`
- `POST /apps/:id/comments`
- `GET /rankings`
- `POST /admin/apps`
- `PUT /admin/apps`
- `DELETE /admin/apps/:id`

## 次に必要な作業

1. Cloudflare Workers プロジェクトを作る
2. D1 database を作る
3. `schema.sql` を流す
4. Worker に `DB` binding と `ADMIN_TOKEN` secret を設定する
5. `app-detail.html` で `window.ISIKORO_API_BASE` にWorker URLを設定する

コメントはスパム対策が必要なので、公開前にNGワード、レート制限、管理者削除を追加するのが前提です。
