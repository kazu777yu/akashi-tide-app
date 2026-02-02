# 明石潮流ナビ

明石海峡の潮汐・潮流情報と釣果記録ができるWebアプリケーション。

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router, TypeScript)
- **スタイリング**: Tailwind CSS
- **データベース**: Supabase (PostgreSQL)
- **ホスティング**: Vercel
- **潮汐データ**: tide736.net API

## 機能

- 明石港の潮汐データ（満潮・干潮時刻と潮位）表示
- 日付選択（前日・翌日ボタン、カレンダー）
- 時間別潮位グラフ
- 潮流の向きと強さの推定表示
- 潮流タイムライン
- 釣果記録機能（Supabase連携）

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、Supabaseの設定を記入します。

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Supabaseテーブル作成

Supabaseのダッシュボードで以下のSQLを実行してテーブルを作成します。

```sql
CREATE TABLE fishing_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  date date NOT NULL,
  time time,
  tide_type text,
  fish_count integer,
  fish_type text,
  memo text,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS (Row Level Security) を有効にする場合
ALTER TABLE fishing_records ENABLE ROW LEVEL SECURITY;

-- 全ユーザーに読み書きを許可するポリシー（必要に応じて変更）
CREATE POLICY "Allow all" ON fishing_records
  FOR ALL USING (true) WITH CHECK (true);
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセスできます。

## Vercelへのデプロイ

1. GitHubにリポジトリをプッシュ
2. [Vercel](https://vercel.com) でプロジェクトをインポート
3. 環境変数を設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. デプロイ実行

## API仕様

### GET /api/tide

tide736.netのAPIをプロキシして明石港の潮汐データを返します。

**パラメータ:**
| パラメータ | 説明 | 例 |
|-----------|------|-----|
| yr | 年 | 2026 |
| mn | 月 | 02 |
| dy | 日 | 01 |

**レスポンス:** tide736.net APIのJSONレスポンスをそのまま返却

## 潮流推定ロジック

- 満潮 → 干潮: **南流（下げ潮）** - 明石海峡を南向きに流れる
- 干潮 → 満潮: **北流（上げ潮）** - 明石海峡を北向きに流れる
- 流速の強さは潮汐サイクルの進行度から推定（中間付近が最も強い）

※ 推定値であり、実際の潮流とは異なる場合があります。
