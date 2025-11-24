import { Client, GatewayIntentBits, SlashCommandBuilder, ChannelType, AttachmentBuilder } from "discord.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

let client: Client | null = null;
let currentModel = "openai/gpt-oss-20b:free";
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

let userConversations: Map<string, UserConversation> = new Map();
let memoryShareEnabled = false;

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

    botStats.commandCount++;

    try {
      await message.channel.sendTyping();

      // 添付ファイルがあれば処理
      let attachmentText = "";
      const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
      const videoExtensions = [".mp4", ".webm", ".mov"];
      const textExtensions = [".txt", ".csv", ".json", ".md", ".log", ".py", ".js", ".ts", ".html", ".css"];
      const imageContents: any[] = [];
      const videoContents: any[] = [];

      if (message.attachments.size > 0) {
        for (const [, attachment] of message.attachments) {
          try {
            const ext = attachment.name.substring(attachment.name.lastIndexOf(".")).toLowerCase();
            const MAX_SIZE = 20 * 1024 * 1024; // 20MB

            if (attachment.size > MAX_SIZE) {
              attachmentText += `\n【${attachment.name}】ファイルサイズが大きすぎます（20MB以下）`;
              continue;
            }

            const fileResponse = await fetch(attachment.url);
            const fileBuffer = await fileResponse.arrayBuffer();
            const base64Data = Buffer.from(fileBuffer).toString("base64");

            if (imageExtensions.includes(ext)) {
              const mediaType = `image/${ext.slice(1)}`;
              imageContents.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              });
              attachmentText += `\n【${attachment.name}】画像を解析しました`;
            } else if (videoExtensions.includes(ext)) {
              const mediaType = ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : "video/quicktime";
              videoContents.push({
                type: "video",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              });
              attachmentText += `\n【${attachment.name}】動画を解析しました`;
            } else if (textExtensions.includes(ext)) {
              const text = new TextDecoder("utf-8").decode(fileBuffer);
              attachmentText += `\n【${attachment.name}】\n${text}`;
            } else {
              attachmentText += `\n【${attachment.name}】非対応形式です`;
            }
          } catch (error) {
            console.error("File processing error:", error);
            attachmentText += `\n【${attachment.name}】ファイル読み込みに失敗しました`;
          }
        }
      }

      const fullMessage = userMessage + attachmentText;
      const userId = message.author.id;
      
      // ユーザー会話履歴を取得または作成
      let userConv = userConversations.get(userId);
      if (!userConv) {
        userConv = { messages: [], lastUpdated: Date.now() };
        userConversations.set(userId, userConv);
      }
      
      // メッセージコンテンツを構築
      const messageContent: any = [{ type: "text", text: fullMessage }];
      messageContent.push(...imageContents);
      messageContent.push(...videoContents);
      
      // メッセージをユーザー履歴に追加
      userConv.messages.push({ role: "user", content: fullMessage });
      
      // 履歴を含めるかどうか決定
      let messagesForAPI: any[] = [];
      if (memoryShareEnabled && userConv.messages.length > 1) {
        // 過去のメッセージを含める（最大20メッセージまで）
        messagesForAPI = userConv.messages.slice(-20).map((msg) => ({
          role: msg.role,
          content: msg.role === "user" ? [{ type: "text", text: msg.content }] : msg.content,
        }));
      } else {
        // 現在のメッセージのみ
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
          model: currentModel,
          messages: messagesForAPI,
          max_tokens: 2000,
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

      const aiResponse = data.choices[0]?.message?.content || "応答がありません";
      console.log(`AI Response length: ${aiResponse.length} characters`);

      // ユーザー履歴に保存
      userConv.messages.push({ role: "assistant", content: aiResponse });
      userConv.lastUpdated = Date.now();

      botChatStats.totalMessages += 2;
      botChatStats.totalTokens += Math.ceil((userMessage.length + aiResponse.length) / 4);
      botChatStats.modelCounts[currentModel] = (botChatStats.modelCounts[currentModel] || 0) + 1;
      botChatStats.totalChats = Object.keys(botChatStats.modelCounts).length;

      // 応答スピード付きで返信
      const finalResponse = `⏱️ ${responseTime}ms\n\n${aiResponse}`;

      if (finalResponse.length > 2000) {
        console.log("Sending response as file (>2000 chars)");
        const attachment = new AttachmentBuilder(Buffer.from(finalResponse, "utf-8"), {
          name: "response.txt",
        });
        await message.reply({
          files: [attachment],
        });
      } else {
        console.log("Sending response as message (<2000 chars)");
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
      const model = interaction.options.getString("model") || "google/gemini-2.5-flash";

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
            model: model,
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

        const aiResponse = data.choices[0]?.message?.content || "応答がありません";
        console.log(`AI Response length: ${aiResponse.length} characters`);

        if (aiResponse.length > 2000) {
          console.log("Sending response as file (>2000 chars)");
          const attachment = new AttachmentBuilder(Buffer.from(aiResponse, "utf-8"), {
            name: "response.txt",
          });
          await interaction.editReply({
            files: [attachment],
          });
        } else {
          console.log("Sending response as message (<2000 chars)");
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
          ephemeral: true,
        });
        return;
      }

      const memberPermissions = interaction.member.permissions;
      if (typeof memberPermissions === "string" || !memberPermissions.has("Administrator")) {
        await interaction.reply({
          content: "❌ このコマンドは管理者のみ使用できます",
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: "📊 **Bot 管理ダッシュボード**\nhttps://31e4757b-3fe9-4e7e-a72a-7eb38290488b-00-246qpws4g77gm.riker.replit.dev/admin",
        ephemeral: true,
      });
    } else if (interaction.commandName === "model") {
      const newModel = interaction.options.getString("model") || "openai/gpt-oss-20b:free";
      currentModel = newModel;
      await interaction.reply({
        content: `✅ **モデルを変更しました**\n選択: ${newModel}`,
        ephemeral: true,
      });
    } else if (interaction.commandName === "model-current") {
      await interaction.reply({
        content: `📊 **現在のモデル**\n${currentModel}`,
        ephemeral: true,
      });
    } else if (interaction.commandName === "summarize") {
      const userId = interaction.user.id;
      const userConv = userConversations.get(userId);

      if (!userConv || userConv.messages.length === 0) {
        await interaction.reply({
          content: "❌ 会話履歴がありません",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        const conversationText = userConv.messages
          .map((msg) => `${msg.role === "user" ? "ユーザー" : "AI"}: ${msg.content}`)
          .join("\n\n");

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://replit.dev",
            "X-Title": "AI Chat Discord Bot",
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [
              {
                role: "user",
                content: `以下の会話を日本語で簡潔に要約してください：\n\n${conversationText}`,
              },
            ],
            max_tokens: 500,
          }),
        });

        const data = (await response.json()) as any;
        const summary = data.choices[0]?.message?.content || "要約に失敗しました";

        if (summary.length > 2000) {
          const attachment = new AttachmentBuilder(Buffer.from(summary, "utf-8"), {
            name: "summary.txt",
          });
          await interaction.editReply({
            files: [attachment],
          });
        } else {
          await interaction.editReply({
            content: `📝 **会話の要約:**\n\n${summary}`,
          });
        }
      } catch (error) {
        console.error("Summary error:", error);
        await interaction.editReply("要約処理中にエラーが発生しました");
      }
    } else if (interaction.commandName === "memory-share") {
      const toggle = interaction.options.getBoolean("enabled");
      memoryShareEnabled = toggle;
      await interaction.reply({
        content: `✅ 全モデル記憶共有: ${toggle ? "有効" : "無効"}`,
        ephemeral: true,
      });
    } else if (interaction.commandName === "help") {
      await interaction.reply({
        content: `🆘 **コマンドヘルプ**

\`/chat <message> [model]\` - AI に質問を送信します
\`/model <model>\` - 使用するモデルを変更します
\`/model-current\` - 現在のモデルを表示します
\`/summarize\` - 会話を要約します
\`/memory-share <enabled>\` - 全モデルで記憶共有のオン・オフ
\`/admin\` - 管理ダッシュボードを表示します
\`/help\` - このメッセージを表示します

**利用可能なモデル:**
• google/gemini-2.5-flash
• openai/o4-mini-high
• openai/gpt-oss-20b:free`,
        ephemeral: true,
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
        )
        .addStringOption((option) =>
          option
            .setName("model")
            .setDescription("AI モデルを選択")
            .setRequired(false)
            .addChoices(
              { name: "Gemini 2.5 Flash", value: "google/gemini-2.5-flash" },
              { name: "gpt-oss-20b", value: "openai/gpt-oss-20b:free" },
              { name: "O4 Mini High", value: "openai/gpt-4o-mini" }
            )
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
        .setName("summarize")
        .setDescription("会話を要約します"),
      new SlashCommandBuilder()
        .setName("memory-share")
        .setDescription("全モデルで記憶共有のオン・オフ")
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("有効にするか無効にするか")
            .setRequired(true)
        ),
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
