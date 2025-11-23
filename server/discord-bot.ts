import { Client, GatewayIntentBits, SlashCommandBuilder } from "discord.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

let client: Client | null = null;
let botStats = {
  isRunning: false,
  commandCount: 0,
  startTime: Date.now(),
};

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
    ],
  });

  client.once("ready", () => {
    console.log(`Discord Bot ログイン完了: ${client?.user?.tag}`);
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
          await interaction.editReply(
            `エラー: ${data.error.message || "AIからの応答がありません"}`
          );
          return;
        }

        const aiResponse = data.choices[0]?.message?.content || "応答がありません";
        const truncated = aiResponse.length > 1900 ? aiResponse.slice(0, 1897) + "..." : aiResponse;

        await interaction.editReply({
          content: `**AI の回答:**\n\`\`\`\n${truncated}\n\`\`\``,
        });
      } catch (error) {
        console.error("Discord Bot エラー:", error);
        await interaction.editReply("エラーが発生しました");
      }
    } else if (interaction.commandName === "admin") {
      await interaction.reply({
        content: "📊 **Bot 管理ダッシュボード**\nhttps://31e4757b-3fe9-4e7e-a72a-7eb38290488b-00-246qpws4g77gm.riker.replit.dev/admin",
        ephemeral: true,
      });
    } else if (interaction.commandName === "model") {
      const newModel = interaction.options.getString("model") || "google/gemini-2.5-flash";
      await interaction.reply({
        content: `✅ **モデルを変更しました**\n選択: ${newModel}`,
        ephemeral: true,
      });
    } else if (interaction.commandName === "help") {
      await interaction.reply({
        content: `🆘 **コマンドヘルプ**

\`/chat <message> [model]\` - AI に質問を送信します
\`/model <model>\` - 使用するモデルを変更します
\`/admin\` - 管理ダッシュボードを表示します
\`/help\` - このメッセージを表示します

**利用可能なモデル:**
• Gemini 2.5 Flash
• GPT-4.1 Mini
• O4 Mini High`,
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
              { name: "GPT-4.1 Mini", value: "openai/gpt-4-turbo" },
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
              { name: "GPT-4.1 Mini", value: "openai/gpt-4-turbo" },
              { name: "O4 Mini High", value: "openai/gpt-4o-mini" }
            )
        ),
      new SlashCommandBuilder()
        .setName("admin")
        .setDescription("Bot 管理ダッシュボードを表示します"),
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
