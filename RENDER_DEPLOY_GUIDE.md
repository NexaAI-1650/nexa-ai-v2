# 🚀 Render へのデプロイ完全ガイド

## 📋 準備するもの
- GitHub アカウント（コード保存用）
- Render アカウント（無料）
- Discord Developer Portal アカウント（既にあり）

---

## ✅ ステップ1: GitHub にコードをプッシュ

Replit ターミナルで実行：

```bash
git add .
git commit -m "Render deployment ready - dynamic redirect URI"
git push origin main
```

✓ これで GitHub に最新コードが保存されます

---

## 🔑 ステップ2: Render アカウント作成とセットアップ

### 2-1: Render にサインアップ
1. https://render.com にアクセス
2. 「Sign Up」をクリック
3. GitHub アカウントで認証（簡単）

### 2-2: 新しい Web Service を作成
1. Render ダッシュボード → 「New」をクリック
2. 「Web Service」を選択
3. GitHub リポを選択（接続が必要な場合は画面に従う）
4. リポを選択して「Continue」

### 2-3: デプロイ設定を入力
以下の設定を入力：

| 項目 | 値 |
|-----|-----|
| **Name** | `nexa-ai` |
| **Region** | `Singapore` または `Tokyo` |
| **Branch** | `main` |
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` |

**Advanced** セクション：
- **Node Version**: `18.17.0`

「Create Web Service」をクリック → デプロイ開始！

---

## 🔐 ステップ3: Environment Variables を設定

**デプロイ中に Render ダッシュボードで以下を実行：**

1. 「Environment」タブをクリック
2. 「Add Environment Variable」を複数回クリック

以下の変数を追加：

```
Key: DISCORD_OAUTH_CLIENT_ID
Value: 1431969498616959017

Key: DISCORD_OAUTH_CLIENT_SECRET  
Value: （Discord Developer Portal から取得した値）

Key: OPENROUTER_API_KEY
Value: （既存の値をコピー）

Key: SESSION_SECRET
Value: （既存の値をコピー）
```

変数を追加したら「Save」をクリック → 自動でデプロイが再起動します

---

## 🌐 ステップ4: Render URL を確認

**Render ダッシュボードで確認できます：**
- 形式: `https://nexa-ai.onrender.com`

このURLが表示されたら成功です！ ✅

---

## 🔗 ステップ5: Discord Developer Portal を更新

1. https://discord.com/developers/applications にアクセス
2. 「Nexa AI」アプリをクリック
3. **OAuth2** → **Redirects** をクリック
4. 「Add Redirect」をクリック
5. 以下を入力：
   ```
   https://nexa-ai.onrender.com/api/auth/callback
   ```
6. 「Save Changes」をクリック ✓

---

## 🎉 これで完成！

### ✅ テスト方法

**Render で Discord OAuth をテスト：**
1. https://nexa-ai.onrender.com/admin にアクセス
2. 「Discord でログイン」をクリック
3. Discord 認証フロー完了 → ダッシュボード表示

**ローカル開発（localhost）でも動作：**
```bash
npm run dev
# http://localhost:5000 でテスト
```

---

## 📝 トラブルシューティング

### ❌ 「Redirect URI mismatch」エラー
→ Discord Developer Portal で登録した URI と Render の URL が一致していることを確認

### ❌ 「Internal Server Error」
→ Render ダッシュボール → Logs を確認。Environment Variables が正しく設定されているか確認

### ❌ 無料プランでスリープ
→ 15 分アイドルで一時停止。アクセスで自動再起動。常時必要なら Pro プラン（$7/月）へ

---

## 💡 補足

| 環境 | Discord OAuth | 使用URL |
|-----|--------|---------|
| ローカル PC | ✅ 本番対応 | http://localhost:5000 |
| Replit Web IDE | ✅ テストログイン機能 | Replit パブリック URL |
| Render 本番 | ✅ 本番対応 | https://nexa-ai.onrender.com |

すべてが同じコードで動作します！ 🎯
