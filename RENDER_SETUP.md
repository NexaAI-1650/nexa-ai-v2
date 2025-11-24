# Render.com デプロイ手順

## 🚀 ステップ1: GitHub に Push
```bash
git add .
git commit -m "Add dynamic redirect URI for Render deployment"
git push origin main
```

## 🚀 ステップ2: Render にデプロイ
1. https://render.com にサインアップ
2. 「New」→「Web Service」を選択
3. GitHub リポジトリを接続
4. 設定：
   - **Name**: nexa-ai
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Node Version**: 18

## 🔑 ステップ3: Environment Variables を設定
Render のダッシュボード → Environment で以下を追加：

```
DISCORD_OAUTH_CLIENT_ID=1431969498616959017
DISCORD_OAUTH_CLIENT_SECRET=（Discord Developer Portal から取得）
OPENROUTER_API_KEY=（既存の値）
SESSION_SECRET=（既存の値または新規生成）
```

## 🔐 ステップ4: Discord Developer Portal を更新
1. https://discord.com/developers/applications に移動
2. 「Nexa AI」アプリを開く
3. OAuth2 → Redirects に以下を追加：
   - `https://nexa-ai.onrender.com/api/auth/callback`

## ✅ これで完成！
- ローカル開発: `npm run dev`で `localhost:5000` を使用
- 本番: Render で固定 URL で常時実行

## 📝 注意事項
- Render の無料プランは 15 分のタイムアウトがあります
- Pro プラン（$7/月）で常時実行可能
