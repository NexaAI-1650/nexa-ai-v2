# AI Chat Application

ChatGPT風のインターフェースで複数のAIモデルと会話できるWebアプリケーション。

## 機能

### コア機能
- **複数AIモデル対応**: OpenRouter経由でGemini 3 Pro Preview、GPT-5.1、GPT-4.1 Miniなど
- **リアルタイムストリーミング**: AIの応答をリアルタイムで表示
- **会話メモリ**: 会話履歴を自動保存・管理
- **画像認識**: 画像を添付してAIに質問可能
- **ダークモード**: ライト/ダークテーマの切り替え

### ユーザーインターフェース
- ChatGPT風の洗練されたデザイン
- サイドバーで会話履歴を管理
- モデル切り替えドロップダウン
- 画像ファイルのドラッグ&ドロップアップロード
- レスポンシブデザイン（モバイル対応）

## 技術スタック

### フロントエンド
- React + TypeScript
- Vite (ビルドツール)
- TailwindCSS (スタイリング)
- Shadcn/ui (UIコンポーネント)
- TanStack Query (データフェッチング)
- Wouter (ルーティング)

### バックエンド
- Express.js
- TypeScript
- OpenRouter API (AIモデル統合)
- インメモリストレージ

## 環境変数

必要なAPIキー:
- `OPENROUTER_API_KEY`: OpenRouter APIキー (必須)

## プロジェクト構造

```
├── client/                 # フロントエンド
│   ├── src/
│   │   ├── components/    # Reactコンポーネント
│   │   │   ├── ui/       # Shadcn UIコンポーネント
│   │   │   ├── chat-message.tsx
│   │   │   ├── chat-input.tsx
│   │   │   ├── conversation-sidebar.tsx
│   │   │   ├── file-upload.tsx
│   │   │   ├── model-selector.tsx
│   │   │   ├── theme-provider.tsx
│   │   │   └── theme-toggle.tsx
│   │   ├── pages/        # ページコンポーネント
│   │   │   └── chat.tsx
│   │   ├── lib/          # ユーティリティ
│   │   ├── App.tsx
│   │   └── index.css
│   └── index.html
├── server/                # バックエンド
│   ├── routes.ts         # APIルート
│   ├── storage.ts        # データストレージ
│   └── app.ts
├── shared/               # 共有型定義
│   └── schema.ts
└── package.json
```

## API エンドポイント

- `GET /api/conversations` - 全会話リストを取得
- `GET /api/conversations/:id` - 特定の会話を取得
- `DELETE /api/conversations/:id` - 会話を削除
- `POST /api/chat` - AIとチャット（ストリーミング応答）

## データモデル

### Message
```typescript
{
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: Array<{
    type: "image";
    url: string;  // Base64 data URL
    name: string;
  }>;
}
```

### Conversation
```typescript
{
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
```

## 使用方法

1. OpenRouter APIキーを環境変数に設定
2. `npm run dev` でアプリケーションを起動
3. ブラウザで http://localhost:5000 を開く
4. AIモデルを選択してチャット開始
5. 画像を添付する場合は、画像アイコンをクリック

## 開発メモ

- 会話履歴はインメモリ保存（サーバー再起動で消失）
- 画像はBase64エンコードで送信（サイズ制限に注意）
- OpenRouterはストリーミングレスポンスをサポート
- ダークモードはlocalStorageに保存

## 今後の改善案

- データベース統合（PostgreSQL）による永続化
- ユーザー認証機能
- 会話のエクスポート/インポート
- カスタムシステムプロンプト
- マルチモーダル対応強化（音声、動画）
