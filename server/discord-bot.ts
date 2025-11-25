import { Client, GatewayIntentBits, SlashCommandBuilder, ChannelType, AttachmentBuilder } from "discord.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ADMIN_GUILD_IDS = process.env.ADMIN_GUILD_IDS?.split(",").map(id => id.trim()) || [];

// ギルド管理権限チェック
export function isGuildAdminAllowed(guildId: string): boolean {
  if (ADMIN_GUILD_IDS.length === 0) {
    console.warn("⚠️  警告: ADMIN_GUILD_IDS が設定されていません。すべてのギルドが管理可能です。");
    return true;
  }
  return ADMIN_GUILD_IDS.includes(guildId);
}

let client: Client | null = null;

// サーバー設定インターフェース
interface GuildSettings {
  currentModel: string;
  rateLimitMax: number;
  memoryShareEnabled: boolean;
}

// サーバーごとの設定
const guildSettings = new Map<string, GuildSettings>();
const DEFAULT_SETTINGS: GuildSettings = {
  currentModel: "openai/gpt-oss-20b:free",
  rateLimitMax: 20,
  memoryShareEnabled: true,
};

let botStats = {
  isRunning: false,
  commandCount: 0,
  startTime: Date.now(),
};
let botChatStats = {
  totalChats: 0,
  totalMessages: 0,
  totalTokens: 0,
  modelCounts: {} as Record<string, number>,
};

// ユーザー会話履歴
interface UserConversation {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  lastUpdated: number;
}

// 拡張子キャッシュ
const EXTENSION_CACHE = {
  images: new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]),
  videos: new Set([".mp4", ".webm", ".mov"]),
  texts: new Set([".txt", ".csv", ".json", ".md", ".log", ".py", ".js", ".ts", ".html", ".css"]),
};

let userConversations: Map<string, UserConversation> = new Map();
let lastModelChangeTime = 0;
const MAX_USER_HISTORY = 10;
const HISTORY_CLEANUP_INTERVAL = 30 * 60 * 1000;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分

// ヘルパー関数
function getGuildSettings(guildId?: string): GuildSettings {
  if (!guildId) return { ...DEFAULT_SETTINGS };
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, { ...DEFAULT_SETTINGS });
  }
  return guildSettings.get(guildId)!;
}

function getGuildIds(): string[] {
  return Array.from(guildSettings.keys());
}

// Bot が入っているサーバーの情報を取得
function getAvailableGuilds(): Array<{ guildId: string; guildName: string; currentModel: string; rateLimitMax: number; memoryShareEnabled: boolean }> {
  if (!client || !client.isReady()) {
    return [];
  }
  
  const guilds = client.guilds.cache.map((guild) => {
    const settings = getGuildSettings(guild.id);
    return {
      guildId: guild.id,
      guildName: guild.name,
      ...settings,
    };
  });
  
  return guilds;
}

// ユーザーごとのレート制限
interface RateLimit {
  count: number;
  resetTime: number;
}
let userRateLimits: Map<string, RateLimit> = new Map();
let userStats: Map<string, { totalChats: number; totalMessages: number }> = new Map();

// テキストに改行を挿入して見やすくする
function formatLongText(text: string, lineLength: number = 60): string {
  let result = '';
  for (let i = 0; i < text.length; i += lineLength) {
    result += text.substring(i, i + lineLength) + '\n';
  }
  return result;
}

// 長いテキストを要約する
async function summarizeIfTooLong(text: string, guildId?: string): Promise<string> {
  if (text.length <= 2000) return text;

  try {
    const settings = getGuildSettings(guildId);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://replit.dev",
        "X-Title": "AI Chat Discord Bot",
      },
      body: JSON.stringify({
        model: settings.currentModel,
        messages: [{ role: "user", content: `以下のテキストを簡潔に要約してください。2000文字以下で。\n\n${text}` }],
        max_tokens: 800,
      }),
    });

    const data = (await response.json()) as any;
    if (data.error) return text;
    return data.choices[0]?.message?.content || text;
  } catch {
    return text;
  }
}

// 定期的に古い会話を削除
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 2 * 60 * 60 * 1000; // 2時間以上古いデータは削除
  for (const [userId, conv] of userConversations.entries()) {
    if (now - conv.lastUpdated > MAX_AGE) {
      userConversations.delete(userId);
    }
  }
}, HISTORY_CLEANUP_INTERVAL);

export async function initDiscordBot() {
  if (!DISCORD_TOKEN || !OPENROUTER_API_KEY) {
    console.log("Discord Bot: DISCORD_TOKEN または OPENROUTER_API_KEY が設定されていません");
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.once("ready", () => {
    console.log(`Discord Bot ログイン完了: ${client?.user?.tag}`);
  });

  // メッセージ作成イベント（メンション・返信対応）
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!client) return;

    const isMentioned = message.mentions.has(client.user!.id);
    const isReply = message.reference !== null;

    if (!isMentioned && !isReply) return;

    let userMessage = message.content.replace(/<@!?\d+>/g, "").trim();
    if (!userMessage && message.attachments.size === 0) return;

    // レート制限チェック（管理者は免除）
    const userId = message.author.id;
    const guildId = message.guildId || "dm";
    const settings = getGuildSettings(guildId);
    const isAdmin = message.member?.permissions.has("Administrator") ?? false;
    
    if (!isAdmin) {
      const now = Date.now();
      let rateLimit = userRateLimits.get(userId);
      
      if (!rateLimit || now >= rateLimit.resetTime) {
        rateLimit = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
        userRateLimits.set(userId, rateLimit);
      }
      
      if (rateLimit.count >= settings.rateLimitMax) {
        const remainingSec = Math.ceil((rateLimit.resetTime - now) / 1000);
        await message.reply({
          content: `⏳ レート制限中です。${remainingSec}秒後に再度使用できます。`,
        });
        return;
      }
      
      rateLimit.count++;
    }
    
    botStats.commandCount++;

    try {
      await message.channel.sendTyping();

      // 添付ファイル処理
      let attachmentText = "";
      const imageContents: any[] = [];
      const videoContents: any[] = [];
      const MAX_SIZE = 20 * 1024 * 1024;

      if (message.attachments.size > 0) {
        for (const [, attachment] of message.attachments) {
          try {
            const ext = attachment.name.substring(attachment.name.lastIndexOf(".")).toLowerCase();

            if (attachment.size > MAX_SIZE) {
              attachmentText += `\n【${attachment.name}】ファイルサイズが大きすぎます（20MB以下）`;
              continue;
            }

            const fileResponse = await fetch(attachment.url);
            const fileBuffer = await fileResponse.arrayBuffer();
            const base64Data = Buffer.from(fileBuffer).toString("base64");

            if (EXTENSION_CACHE.images.has(ext)) {
              imageContents.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: `image/${ext.slice(1)}`,
                  data: base64Data,
                },
              });
              attachmentText += `\n【${attachment.name}】`;
            } else if (EXTENSION_CACHE.videos.has(ext)) {
              const mediaType = ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : "video/quicktime";
              videoContents.push({
                type: "video",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              });
              attachmentText += `\n【${attachment.name}】`;
            } else if (EXTENSION_CACHE.texts.has(ext)) {
              const text = new TextDecoder("utf-8").decode(fileBuffer);
              attachmentText += `\n【${attachment.name}】\n${text}`;
            } else {
              attachmentText += `\n【${attachment.name}】非対応形式です`;
            }
          } catch {
            attachmentText += `\n【${attachment.name}】読み込み失敗`;
          }
        }
      }

      const fullMessage = userMessage + attachmentText;
      
      // ユーザー会話履歴を取得または作成
      let userConv = userConversations.get(userId);
      if (!userConv) {
        userConv = { messages: [], lastUpdated: Date.now() };
        userConversations.set(userId, userConv);
      }
      
      // メッセージコンテンツを構築
      const messageContent: any = [{ type: "text", text: fullMessage }, ...imageContents, ...videoContents];
      
      // メッセージをユーザー履歴に追加
      userConv.messages.push({ role: "user", content: fullMessage });
      
      // 履歴を最大サイズまで制限
      if (userConv.messages.length > MAX_USER_HISTORY) {
        userConv.messages = userConv.messages.slice(-MAX_USER_HISTORY);
      }
      
      // 履歴を含めるかどうか決定
      let messagesForAPI: any[] = [];
      if (settings.memoryShareEnabled && userConv.messages.length > 1) {
        messagesForAPI = userConv.messages.map((msg) => ({
          role: msg.role,
          content: msg.role === "user" ? [{ type: "text", text: msg.content }] : msg.content,
        }));
      } else {
        messagesForAPI = [{ role: "user", content: messageContent }];
      }

      const startTime = Date.now();
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://replit.dev",
          "X-Title": "AI Chat Discord Bot",
        },
        body: JSON.stringify({
          model: settings.currentModel,
          messages: messagesForAPI,
          max_tokens: 1000,
        }),
      });
      const responseTime = Date.now() - startTime;

      const data = (await response.json()) as any;

      if (data.error) {
        const errorMsg = data.error.message || "AIからの応答がありません";
        let userMessage = "❌ エラーが発生しました。後でもう一度試してください。";
        
        if (errorMsg.includes("credits") || errorMsg.includes("max_tokens")) {
          userMessage = "❌ APIの利用制限に達しました。後でもう一度試してください。";
        }
        
        await message.reply({
          content: userMessage,
        });
        return;
      }

      let aiResponse = data.choices[0]?.message?.content || "応答がありません";

      // 2000文字以上なら要約
      if (aiResponse.length > 2000) {
        aiResponse = await summarizeIfTooLong(aiResponse, guildId);
      }

      // ユーザー履歴に保存
      userConv.messages.push({ role: "assistant", content: aiResponse });
      userConv.lastUpdated = Date.now();

      botChatStats.totalMessages += 2;
      botChatStats.totalTokens += Math.ceil((userMessage.length + aiResponse.length) / 4);
      botChatStats.modelCounts[settings.currentModel] = (botChatStats.modelCounts[settings.currentModel] || 0) + 1;
      botChatStats.totalChats = Object.keys(botChatStats.modelCounts).length;

      // ユーザー統計を更新
      let userStat = userStats.get(userId);
      if (!userStat) userStat = { totalChats: 0, totalMessages: 0 };
      userStat.totalMessages += 2;
      if (!userConversations.get(userId)?.messages.length) userStat.totalChats += 1;
      userStats.set(userId, userStat);

      // 応答スピード付きで返信
      const finalResponse = `⏱️ ${responseTime}ms\n\n${aiResponse}`;

      if (finalResponse.length > 2000) {
        const formattedText = formatLongText(finalResponse);
        const attachment = new AttachmentBuilder(Buffer.from(formattedText, "utf-8"), {
          name: "response.txt",
        });
        await message.reply({
          files: [attachment],
        });
      } else {
        await message.reply({
          content: finalResponse,
        });
      }
    } catch (error) {
      console.error("Discord Bot メッセージ処理エラー:", error);
      await message.reply("エラーが発生しました");
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === "chat") {
      const message = interaction.options.getString("message") || "";
      const guildId = interaction.guildId || "dm";
      const settings = getGuildSettings(guildId);

      botStats.commandCount++;

      await interaction.deferReply();

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://replit.dev",
            "X-Title": "AI Chat Discord Bot",
          },
          body: JSON.stringify({
            model: settings.currentModel,
            messages: [{ role: "user", content: message }],
            max_tokens: 1000,
          }),
        });

        const data = (await response.json()) as any;

        if (data.error) {
          const errorMsg = data.error.message || "AIからの応答がありません";
          let userMessage = "❌ エラーが発生しました。後でもう一度試してください。";
          
          if (errorMsg.includes("credits") || errorMsg.includes("max_tokens")) {
            userMessage = "❌ APIの利用制限に達しました。後でもう一度試してください。";
          }
          
          await interaction.editReply(userMessage);
          return;
        }

        let aiResponse = data.choices[0]?.message?.content || "応答がありません";

        // 2000文字以上なら要約
        if (aiResponse.length > 2000) {
          aiResponse = await summarizeIfTooLong(aiResponse);
        }

        if (aiResponse.length > 2000) {
          const formattedText = formatLongText(aiResponse);
          const attachment = new AttachmentBuilder(Buffer.from(formattedText, "utf-8"), {
            name: "response.txt",
          });
          await interaction.editReply({
            files: [attachment],
          });
        } else {
          await interaction.editReply({
            content: aiResponse,
          });
        }
      } catch (error) {
        console.error("Discord Bot エラー:", error);
        await interaction.editReply("エラーが発生しました");
      }
    } else if (interaction.commandName === "admin") {
      if (!interaction.inGuild() || !interaction.member) {
        await interaction.reply({
          content: "❌ このコマンドはサーバー内でのみ使用できます",
          flags: 64
        });
        return;
      }

      const memberPermissions = interaction.member.permissions;
      if (typeof memberPermissions === "string" || !memberPermissions.has("Administrator")) {
        await interaction.reply({
          content: "❌ このコマンドは管理者のみ使用できます",
          flags: 64,
        });
        return;
      }

      await interaction.reply({
        content: `📊 **Bot 管理ダッシュボード**\n${DASHBOARD_URL}`,
        flags: 64
      });
    } else if (interaction.commandName === "model") {
      const now = Date.now();
      const cooldownMs = 5000;
      
      if (now - lastModelChangeTime < cooldownMs) {
        const remainingMs = cooldownMs - (now - lastModelChangeTime);
        await interaction.reply({
          content: `⏳ モデル変更はあと ${Math.ceil(remainingMs / 1000)} 秒後に可能です`,
          flags: 64
        });
        return;
      }
      
      const newModel = interaction.options.getString("model") || "openai/gpt-oss-20b:free";
      const guildId = interaction.guildId || "dm";
      setCurrentModel(newModel, guildId);
      lastModelChangeTime = now;
      await interaction.reply({
        content: `✅ **モデルを変更しました**\n選択: ${newModel}`,
        flags: 64
      });
    } else if (interaction.commandName === "model-current") {
      const guildId = interaction.guildId || "dm";
      const currentModel = getCurrentModel(guildId);
      await interaction.reply({
        content: `📊 **現在のモデル**\n${currentModel}`,
        flags: 64
      });
    } else if (interaction.commandName === "clear") {
      const userId = interaction.user.id;
      userConversations.delete(userId);
      await interaction.reply({
        content: "✅ 会話履歴をクリアしました。新しい話題を始められます。",
        flags: 64
      });
    } else if (interaction.commandName === "stats") {
      const userId = interaction.user.id;
      const userStat = userStats.get(userId) || { totalChats: 0, totalMessages: 0 };
      const isAdmin = interaction.inGuild() && interaction.member?.permissions.has("Administrator");
      const guildId = interaction.guildId || "dm";
      const rateLimitMax = getRateLimit(guildId);
      const rateLimitText = isAdmin ? `無制限/${Math.floor(RATE_LIMIT_WINDOW / 1000)}秒` : `${rateLimitMax}/${Math.floor(RATE_LIMIT_WINDOW / 1000)}秒`;
      await interaction.reply({
        content: `📊 **あなたの統計**
• 総チャット数: ${userStat.totalChats}
• 総メッセージ数: ${userStat.totalMessages}
• レート制限: ${rateLimitText}`,
        flags: 64
      });
    } else if (interaction.commandName === "help") {
      await interaction.reply({
        content: `🆘 **コマンドヘルプ**

\`/chat <message>\` - AI に質問を送信します
\`/clear\` - 会話履歴をクリアします
\`/stats\` - あなたの使用統計を表示します
\`/model <model>\` - 使用するモデルを変更します (クールダウン: 5秒)
\`/model-current\` - 現在のモデルを表示します
\`/admin\` - 管理ダッシュボードを表示します
\`/help\` - このメッセージを表示します

**利用可能なモデル:**
• google/gemini-2.5-flash
• openai/o4-mini-high
• openai/gpt-oss-20b:free`,
        flags: 64
      });
    }
  });

  try {
    await client.login(DISCORD_TOKEN);
    botStats.isRunning = true;
  } catch (error) {
    console.error("Discord Bot ログイン失敗:", error);
  }
}

export async function restartDiscordBot() {
  botStats.isRunning = false;
  if (client?.isReady()) {
    await client.destroy();
    client = null;
  }
  botStats = {
    isRunning: false,
    commandCount: 0,
    startTime: Date.now(),
  };
  await initDiscordBot();
}

export async function shutdownDiscordBot() {
  if (client?.isReady()) {
    await client.destroy();
    client = null;
    botStats.isRunning = false;
  }
}

export async function startDiscordBot() {
  if (botStats.isRunning) {
    console.log("Discord Bot:既に実行中です");
    return;
  }
  await initDiscordBot();
}

export function getBotStatus() {
  return botStats;
}

export function getBotChatStats() {
  return botChatStats;
}

export function getMemoryShareEnabled(guildId?: string) {
  const settings = getGuildSettings(guildId);
  return settings.memoryShareEnabled;
}

export function setMemoryShareEnabled(enabled: boolean, guildId?: string) {
  const settings = getGuildSettings(guildId);
  settings.memoryShareEnabled = enabled;
}

export function getCurrentModel(guildId?: string) {
  const settings = getGuildSettings(guildId);
  return settings.currentModel;
}

export function setCurrentModel(model: string, guildId?: string) {
  const settings = getGuildSettings(guildId);
  settings.currentModel = model;
}

export function getRateLimit(guildId?: string) {
  const settings = getGuildSettings(guildId);
  return settings.rateLimitMax;
}

export function setRateLimit(limit: number, guildId?: string) {
  const settings = getGuildSettings(guildId);
  settings.rateLimitMax = Math.max(1, Math.min(limit, 100)); // 1～100の間に制限
}

export function getAllGuildSettings() {
  return guildSettings;
}

export function getAvailableGuildsExport() {
  return getAvailableGuilds();
}

export async function registerSlashCommands() {
  if (!client || !client.isReady()) {
    console.log("Discord Bot がまだ準備完了していません");
    return;
  }

  try {
    const commands = [
      new SlashCommandBuilder()
        .setName("chat")
        .setDescription("AI に質問を送信します")
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("質問内容")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("model")
        .setDescription("使用するモデルを変更します")
        .addStringOption((option) =>
          option
            .setName("model")
            .setDescription("AI モデルを選択")
            .setRequired(true)
            .addChoices(
              { name: "Gemini 2.5 Flash", value: "google/gemini-2.5-flash" },
              { name: "gpt-oss-20b", value: "openai/gpt-oss-20b:free" },
              { name: "O4 Mini High", value: "openai/gpt-4o-mini" }
            )
        ),
      new SlashCommandBuilder()
        .setName("admin")
        .setDescription("Bot 管理ダッシュボードを表示します"),
      new SlashCommandBuilder()
        .setName("model-current")
        .setDescription("現在のモデルを表示します"),
      new SlashCommandBuilder()
        .setName("clear")
        .setDescription("会話履歴をクリアします"),
      new SlashCommandBuilder()
        .setName("stats")
        .setDescription("あなたの使用統計を表示します"),
      new SlashCommandBuilder()
        .setName("help")
        .setDescription("コマンドヘルプを表示します"),
    ];

    await client.application?.commands.set(commands);
    console.log("Discord Bot: スラッシュコマンドを登録しました");
  } catch (error) {
    console.error("コマンド登録エラー:", error);
  }
}
