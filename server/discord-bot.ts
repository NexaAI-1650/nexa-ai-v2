import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { storage } from "./storage";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ADMIN_GUILD_IDS =
  process.env.ADMIN_GUILD_IDS?.split(",").map((id) => id.trim()) || [];

// ダッシュボードURL（環境に応じて動的に設定）
const DASHBOARD_URL =
  process.env.DASHBOARD_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/admin`
    : "https://nexa-ai-fgdx.onrender.com/admin");

// Check if guild admin is allowed
export function isGuildAdminAllowed(guildId: string): boolean {
  if (ADMIN_GUILD_IDS.length === 0) {
    console.warn(
      "⚠️  Warning: ADMIN_GUILD_IDS not configured. All guilds are manageable.",
    );
    return true;
  }
  return ADMIN_GUILD_IDS.includes(guildId);
}

let client: Client | null = null;

// Guild settings interface
interface GuildSettings {
  currentModel: string;
  rateLimitMax: number;
  memoryShareEnabled: boolean;
}

// Per-guild settings
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

// User conversation history
interface UserConversation {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  lastUpdated: number;
}

// User settings
interface UserSettings {
  economyMode: boolean;
  selectedPlugin?: string;
}

// File extension cache
const EXTENSION_CACHE = {
  images: new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]),
  videos: new Set([".mp4", ".webm", ".mov"]),
  texts: new Set([
    ".txt",
    ".csv",
    ".json",
    ".md",
    ".log",
    ".py",
    ".js",
    ".ts",
    ".html",
    ".css",
  ]),
};

let userConversations: Map<string, UserConversation> = new Map();
let userSettings: Map<string, UserSettings> = new Map();
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
function getAvailableGuilds(): Array<{
  guildId: string;
  guildName: string;
  currentModel: string;
  rateLimitMax: number;
  memoryShareEnabled: boolean;
}> {
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

// Rate limiting per user
interface RateLimit {
  count: number;
  resetTime: number;
}
let userRateLimits: Map<string, RateLimit> = new Map();
let userStats: Map<string, { totalChats: number; totalMessages: number }> =
  new Map();

// Get user settings
function getUserSettings(userId: string): UserSettings {
  if (!userSettings.has(userId)) {
    userSettings.set(userId, { economyMode: false });
  }
  return userSettings.get(userId)!;
}

// Summarize long responses in Economy Mode
async function summarizeIfEconomyMode(
  text: string,
  userId: string,
  guildId?: string,
): Promise<string> {
  const settings = getUserSettings(userId);
  if (!settings.economyMode) return text;
  if (text.length <= 1500) return text;

  try {
    const guildSettings = getGuildSettings(guildId);
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://replit.dev",
          "X-Title": "AI Chat Discord Bot",
        },
        body: JSON.stringify({
          model: guildSettings.currentModel,
          messages: [
            {
              role: "user",
              content: `Summarize this concisely in 500 characters or less:\n\n${text}`,
            },
          ],
          max_tokens: 200,
        }),
      },
    );

    const data = (await response.json()) as any;
    if (data.error) return text;
    return data.choices[0]?.message?.content || text;
  } catch {
    return text;
  }
}

// Format long text with line breaks
function formatLongText(text: string, lineLength: number = 60): string {
  let result = "";
  for (let i = 0; i < text.length; i += lineLength) {
    result += text.substring(i, i + lineLength) + "\n";
  }
  return result;
}

// 長いテキストを要約する
async function summarizeIfTooLong(
  text: string,
  guildId?: string,
): Promise<string> {
  if (text.length <= 2000) return text;

  try {
    const settings = getGuildSettings(guildId);
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://replit.dev",
          "X-Title": "AI Chat Discord Bot",
        },
        body: JSON.stringify({
          model: settings.currentModel,
          messages: [
            {
              role: "user",
              content: `以下のテキストを簡潔に要約してください。2000文字以下で。\n\n${text}`,
            },
          ],
          max_tokens: 800,
        }),
      },
    );

    const data = (await response.json()) as any;
    if (data.error) return text;
    return data.choices[0]?.message?.content || text;
  } catch {
    return text;
  }
}

// サーバー管理コマンドを処理
async function handleManagementCommand(message: any): Promise<boolean> {
  return false;
}


// Periodically clean up old conversations
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 2 * 60 * 60 * 1000; // Remove data older than 2 hours
  for (const [userId, conv] of userConversations.entries()) {
    if (now - conv.lastUpdated > MAX_AGE) {
      userConversations.delete(userId);
    }
  }
}, HISTORY_CLEANUP_INTERVAL);

export async function initDiscordBot() {
  if (!DISCORD_TOKEN || !OPENROUTER_API_KEY) {
    console.log(
      "Discord Bot: DISCORD_TOKEN または OPENROUTER_API_KEY が設定されていません",
    );
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

  // エラーハンドラ
  client.on("error", (error) => {
    console.error("Discord.js エラー:", error);
  });

  client.on("warn", (warn) => {
    console.warn("Discord.js Warning:", warn);
  });

  // Handle message creation (mentions, replies, threads)
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!client) return;

    const isMentioned = message.mentions.has(client.user!.id);
    const isReply = message.reference !== null;
    const isThread = message.channel.isThread();

    // Respond to threads, mentions, or replies
    if (!isMentioned && !isReply && !isThread) return;

    // Handle management commands
    const isManagementCommand = await handleManagementCommand(message);
    if (isManagementCommand) return;

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
      // 定期的に typing を送信（3秒ごと）
      let typingInterval: NodeJS.Timeout | null = setInterval(async () => {
        try {
          await message.channel.sendTyping();
        } catch (e) {
          if (typingInterval) clearInterval(typingInterval);
        }
      }, 3000);

      await message.channel.sendTyping();

      // Handle attachments
      let attachmentText = "";
      const imageContents: any[] = [];
      const videoContents: any[] = [];
      const MAX_SIZE = 20 * 1024 * 1024;

      if (message.attachments.size > 0) {
        for (const [, attachment] of message.attachments) {
          try {
            const ext = attachment.name
              .substring(attachment.name.lastIndexOf("."))
              .toLowerCase();

            if (attachment.size > MAX_SIZE) {
              attachmentText += `\n【${attachment.name}】File size too large (max 20MB)`;
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
              const mediaType =
                ext === ".mp4"
                  ? "video/mp4"
                  : ext === ".webm"
                    ? "video/webm"
                    : "video/quicktime";
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
              attachmentText += `\n【${attachment.name}】Unsupported format`;
            }
          } catch {
            attachmentText += `\n【${attachment.name}】Load failed`;
          }
        }
      }

      const fullMessage = userMessage + attachmentText;

      // Get or create user conversation
      let userConv = userConversations.get(userId);
      if (!userConv) {
        userConv = { messages: [], lastUpdated: Date.now() };
        userConversations.set(userId, userConv);
      }

      // Build message content
      const messageContent: any = [
        {
          type: "text",
          text: `Answer concisely in 2000 characters or less.\n\n${fullMessage}`,
        },
        ...imageContents,
        ...videoContents,
      ];

      // Add message to user history
      userConv.messages.push({ role: "user", content: fullMessage });

      // Limit history to max size
      if (userConv.messages.length > MAX_USER_HISTORY) {
        userConv.messages = userConv.messages.slice(-MAX_USER_HISTORY);
      }

      // Decide whether to include history
      let messagesForAPI: any[] = [];
      if (settings.memoryShareEnabled && userConv.messages.length > 1) {
        messagesForAPI = userConv.messages.map((msg) => ({
          role: msg.role,
          content:
            msg.role === "user"
              ? [
                  {
                    type: "text",
                    text: `Answer concisely in 2000 characters or less.\n\n${msg.content}`,
                  },
                ]
              : msg.content,
        }));
      } else {
        messagesForAPI = [{ role: "user", content: messageContent }];
      }

      const startTime = Date.now();
      const userSet = getUserSettings(userId);
      const maxTokens = userSet.economyMode ? 400 : 800;

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://replit.dev",
            "X-Title": "AI Chat Discord Bot",
          },
          body: JSON.stringify({
            model: settings.currentModel,
            messages: messagesForAPI,
            max_tokens: maxTokens,
          }),
        },
      );
      const responseTime = Date.now() - startTime;

      const data = (await response.json()) as any;

      if (data.error) {
        const errorMsg = data.error.message || "No response from AI";
        let errorMessage =
          "❌ An error occurred. Please try again later.";

        if (errorMsg.includes("credits") || errorMsg.includes("max_tokens")) {
          errorMessage =
            "❌ API rate limit reached. Please try again later.";
        }

        await message.reply({
          content: errorMessage,
        });
        if (typingInterval) clearInterval(typingInterval);
        return;
      }

      let aiResponse = data.choices[0]?.message?.content || "No response";

      // Summarize long responses in Economy Mode
      aiResponse = await summarizeIfEconomyMode(aiResponse, userId, guildId);

      // Save to user history
      userConv.messages.push({ role: "assistant", content: aiResponse });
      userConv.lastUpdated = Date.now();

      botChatStats.totalMessages += 2;
      botChatStats.totalTokens += Math.ceil(
        (userMessage.length + aiResponse.length) / 4,
      );
      botChatStats.modelCounts[settings.currentModel] =
        (botChatStats.modelCounts[settings.currentModel] || 0) + 1;
      botChatStats.totalChats = Object.keys(botChatStats.modelCounts).length;

      // Update user statistics
      let userStat = userStats.get(userId);
      if (!userStat) userStat = { totalChats: 0, totalMessages: 0 };
      userStat.totalMessages += 2;
      if (!userConversations.get(userId)?.messages.length)
        userStat.totalChats += 1;
      userStats.set(userId, userStat);

      // Reply with response time
      const finalResponse = `⏱️ ${responseTime}ms\n\n${aiResponse}`;

      if (finalResponse.length > 2000) {
        const formattedText = formatLongText(finalResponse);
        const attachment = new AttachmentBuilder(
          Buffer.from(formattedText, "utf-8"),
          { name: "response.txt" },
        );
        await message.reply({ files: [attachment] });
      } else {
        await message.reply({ content: finalResponse });
      }

      if (typingInterval) clearInterval(typingInterval);
      return;
    } catch (error) {
      console.error("Discord Bot message processing error:", error);
      await message.reply("An error occurred");
      if (typingInterval) clearInterval(typingInterval);
      return;
    }
  });

  client.on("interactionCreate", async (interaction) => {
    // ドロップダウン処理
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      const userId = interaction.user.id;

      if (customId === "model_change") {
        const selectedModel = interaction.values[0];
        const guildId = interaction.guildId || "dm";
        setCurrentModel(selectedModel, guildId);
        await interaction.reply({
          content: `✅ Model changed to: **${selectedModel}**`,
          ephemeral: true,
        });
      } else if (customId === "plugin_select") {
        const selectedPlugin = interaction.values[0];
        const userSet = getUserSettings(userId);
        userSet.selectedPlugin = selectedPlugin;
        await interaction.reply({
          content: `✅ Plugin selected: **${selectedPlugin}**\n(Not yet integrated - coming soon!)`,
          ephemeral: true,
        });
      }
      return;
    }

    // ボタン処理
    if (interaction.isButton()) {
      const customId = interaction.customId;
      const userId = interaction.user.id;
      const guildId = interaction.guildId || "dm";

      if (customId === "economy_mode") {
        const userSet = getUserSettings(userId);
        userSet.economyMode = !userSet.economyMode;
        const status = userSet.economyMode ? "ON" : "OFF";
        await interaction.reply({
          content: `♻️ **Economy Mode: ${status}**\n\nWhen ON:\n• Max tokens reduced to 400\n• Long responses automatically summarized\n• Reduced server load`,
          ephemeral: true,
        });
      } else if (customId === "restart") {
        // Clear thread conversation cache
        userConversations.delete(userId);
        await interaction.reply({
          content:
            "🔄 **Thread cache cleared!**\nConversation history has been reset for this thread.",
          ephemeral: true,
        });
      } else if (customId === "delete_conversation") {
        // Delete all user conversations
        userConversations.delete(userId);
        await interaction.reply({
          content:
            "🗑️ **Conversation deleted!**\nAll your conversation history has been removed.",
          ephemeral: true,
        });
      } else if (customId === "rename") {
        // Prompt user to rename thread
        const thread = interaction.channel;
        if (thread?.isThread()) {
          await interaction.reply({
            content:
              "📝 **To rename this thread, send a message starting with `/rename ` followed by the new name**\n\nExample: `/rename My New Thread Name`",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "❌ This command only works in threads.",
            ephemeral: true,
          });
        }
      }
      return;
    }

    if (!interaction.isCommand()) return;

    if (interaction.commandName === "chat") {
      const guildId = interaction.guildId || "dm";
      const settings = getGuildSettings(guildId);

      botStats.commandCount++;

      await interaction.deferReply();

      try {
        // Create thread
        const thread = await interaction.channel?.threads.create({
          name: "Nexa AI | Conversation",
          autoArchiveDuration: 60,
        });

        if (!thread) {
          await interaction.editReply("Thread creation failed");
          return;
        }

        // Add bot and user to thread
        try {
          await thread.members.add(client?.user?.id || "");
          await thread.members.add(interaction.user.id);
        } catch (err) {
          console.log("Failed to add members to thread:", err);
        }

        try {
          const row1 = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("model_change")
                .setPlaceholder("Select AI Model")
                .addOptions(
                  new StringSelectMenuOptionBuilder()
                    .setLabel("gpt-oss-20b:free")
                    .setValue("openai/gpt-oss-20b:free")
                    .setDefault(true),
                  new StringSelectMenuOptionBuilder()
                    .setLabel("google/gemini-2.5-flash")
                    .setValue("google/gemini-2.5-flash"),
                  new StringSelectMenuOptionBuilder()
                    .setLabel("openai/o4-mini-high")
                    .setValue("openai/o4-mini-high"),
                ),
            );

          const row2 = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId("economy_mode")
                .setLabel("Economy Mode")
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId("restart")
                .setLabel("Restart")
                .setStyle(ButtonStyle.Danger),
            );

          const row3 = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("plugin_select")
                .setPlaceholder("Select Plugin")
                .addOptions(
                  new StringSelectMenuOptionBuilder()
                    .setLabel("Calculator")
                    .setValue("calculator"),
                  new StringSelectMenuOptionBuilder()
                    .setLabel("WolframAlpha")
                    .setValue("wolframalpha"),
                  new StringSelectMenuOptionBuilder()
                    .setLabel("Google Search")
                    .setValue("google_search"),
                ),
            );

          const row4 = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId("delete_conversation")
                .setLabel("Delete Conversation")
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId("rename")
                .setLabel("Rename")
                .setStyle(ButtonStyle.Secondary),
            );

          const pinMessage = await thread.send({
            content: `**⚙️ Chat Controls**

**━━ AI Settings ━━**
🤖 **Model** - Select your AI model
♻️ **Economy Mode** - Reduce tokens & auto-summarize
🔄 **Restart** - Clear conversation cache

**━━ Tools ━━**
🔧 **Plugins** - Calculator • WolframAlpha • Google Search

**━━ Management ━━**
🗑️ **Delete** - Clear chat history
✏️ **Rename** - Change thread name`,
            components: [row1, row2, row3, row4],
          });

          console.log("UI message sent successfully");

          if (pinMessage) {
            await pinMessage.pin().catch((err) => console.error("Failed to pin message:", err));
          }

          await interaction.editReply(`✅ Thread created: ${thread.url}\n\nStart typing your question in the thread!`);
        } catch (error) {
          console.error("Failed to send UI message:", error);
          console.log("Error details:", JSON.stringify(error, null, 2));
        }
      } catch (error) {
        console.error("Discord Bot error:", error);
        await interaction.editReply("Error occurred");
      }
    } else if (interaction.commandName === "admin") {
      try {
        if (!interaction.inGuild() || !interaction.member) {
          await interaction.reply({
            content: "❌ このコマンドはサーバー内でのみ使用できます",
            flags: 64,
          });
          return;
        }

        const memberPermissions = interaction.member.permissions;
        if (
          typeof memberPermissions === "string" ||
          !memberPermissions.has("Administrator")
        ) {
          await interaction.reply({
            content: "❌ このコマンドは管理者のみ使用できます",
            flags: 64,
          });
          return;
        }

        await interaction.reply({
          content: `📊 **Bot 管理ダッシュボード**\n${DASHBOARD_URL}`,
          flags: 64,
        });
      } catch (error) {
        console.error("Admin command error:", error);
        try {
          await interaction.reply({
            content: "❌ コマンド処理中にエラーが発生しました",
            flags: 64,
          });
        } catch {
          console.error("Failed to send error reply");
        }
      }
    } else if (interaction.commandName === "model") {
      try {
        const now = Date.now();
        const cooldownMs = 5000;

        if (now - lastModelChangeTime < cooldownMs) {
          const remainingMs = cooldownMs - (now - lastModelChangeTime);
          await interaction.reply({
            content: `⏳ Model change available in ${Math.ceil(remainingMs / 1000)} seconds`,
            flags: 64,
          });
          return;
        }

        const newModel =
          interaction.options.getString("model") || "openai/gpt-oss-20b:free";
        const guildId = interaction.guildId || "dm";
        setCurrentModel(newModel, guildId);
        lastModelChangeTime = now;
        await interaction.reply({
          content: `✅ **Model changed**\nSelected: ${newModel}`,
          flags: 64,
        });
      } catch (error) {
        console.error("Model command error:", error);
      }
    } else if (interaction.commandName === "model-current") {
      try {
        const guildId = interaction.guildId || "dm";
        const currentModel = getCurrentModel(guildId);
        await interaction.reply({
          content: `📊 **Current Model**\n${currentModel}`,
          flags: 64,
        });
      } catch (error) {
        console.error("Model-current command error:", error);
      }
    } else if (interaction.commandName === "clear") {
      try {
        const userId = interaction.user.id;
        userConversations.delete(userId);
        await interaction.reply({
          content: "✅ Conversation history cleared! You can start a new conversation.",
          flags: 64,
        });
      } catch (error) {
        console.error("Clear command error:", error);
      }
    } else if (interaction.commandName === "stats") {
      try {
        const userId = interaction.user.id;
        const userStat = userStats.get(userId) || {
          totalChats: 0,
          totalMessages: 0,
        };
        const isAdmin =
          interaction.inGuild() &&
          interaction.member?.permissions.has("Administrator");
        const guildId = interaction.guildId || "dm";
        const rateLimitMax = getRateLimit(guildId);
        const rateLimitText = isAdmin
          ? `Unlimited/${Math.floor(RATE_LIMIT_WINDOW / 1000)}s`
          : `${rateLimitMax}/${Math.floor(RATE_LIMIT_WINDOW / 1000)}s`;
        await interaction.reply({
          content: `📊 **Your Statistics**
• Total Chats: ${userStat.totalChats}
• Total Messages: ${userStat.totalMessages}
• Rate Limit: ${rateLimitText}`,
          flags: 64,
        });
      } catch (error) {
        console.error("Stats command error:", error);
      }
    } else if (interaction.commandName === "rename") {
      try {
        const newName = interaction.options.getString("name");
        if (!newName) {
          await interaction.reply({
            content: "❌ Thread name is required",
            flags: 64,
          });
          return;
        }

        const thread = interaction.channel;
        if (!thread?.isThread()) {
          await interaction.reply({
            content: "❌ This command only works in threads.",
            flags: 64,
          });
          return;
        }

        await thread.setName(newName);
        await interaction.reply({
          content: `✅ **Thread renamed to: ${newName}**`,
          flags: 64,
        });
      } catch (error) {
        console.error("Rename command error:", error);
        await interaction.reply({
          content: "❌ Failed to rename thread",
          flags: 64,
        });
      }
    } else if (interaction.commandName === "help") {
      try {
        await interaction.reply({
          content: `🆘 **Command Help**

\`/chat\` - Start a conversation thread
\`/rename <name>\` - Rename the current thread
\`/clear\` - Clear your conversation history
\`/stats\` - Display your usage statistics
\`/model <model>\` - Change the AI model (cooldown: 5 seconds)
\`/model-current\` - Display the current AI model
\`/admin\` - Open the admin dashboard
\`/help\` - Display this help message

**Available Models:**
• google/gemini-2.5-flash
• openai/o4-mini-high
• openai/gpt-oss-20b:free

**Thread Controls:**
• Model Change dropdown - Change AI model instantly
• Economy Mode button - Cost-saving mode (reduced tokens & auto-summarize)
• Restart button - Reset thread cache
• Plugin dropdown - Calculator/WolframAlpha/Google Search
• Delete Conversation - Remove all chat history
• Rename button - Change thread name`,
          flags: 64,
        });
      } catch (error) {
        console.error("Help command error:", error);
      }
    }
  });

  try {
    await client.login(DISCORD_TOKEN);
    botStats.isRunning = true;
  } catch (error) {
    console.error("Discord Bot login failed:", error);
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
    console.log("Discord Bot: Already running");
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
        .setDescription("Use this command to start a ChatGPT conversation in a thread."),
      new SlashCommandBuilder()
        .setName("model")
        .setDescription("Change the AI model")
        .addStringOption((option) =>
          option
            .setName("model")
            .setDescription("Select an AI model")
            .setRequired(true)
            .addChoices(
              { name: "Gemini 2.5 Flash", value: "google/gemini-2.5-flash" },
              { name: "gpt-oss-20b", value: "openai/gpt-oss-20b:free" },
              { name: "O4 Mini High", value: "openai/gpt-4o-mini" },
            ),
        ),
      new SlashCommandBuilder()
        .setName("admin")
        .setDescription("View the Nexa AI admin dashboard"),
      new SlashCommandBuilder()
        .setName("model-current")
        .setDescription("Display the current AI model"),
      new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear your conversation history"),
      new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Display your usage statistics"),
      new SlashCommandBuilder()
        .setName("rename")
        .setDescription("Rename the current thread")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("New thread name")
            .setRequired(true),
        ),
      new SlashCommandBuilder()
        .setName("help")
        .setDescription("Display command help"),
    ];

    await client.application?.commands.set(commands);
    console.log("Discord Bot: Slash commands registered");
  } catch (error) {
    console.error("Command registration error:", error);
  }
}
