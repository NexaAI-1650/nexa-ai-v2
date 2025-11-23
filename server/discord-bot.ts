import { Client, GatewayIntentBits, SlashCommandBuilder } from "discord.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

let client: Client | null = null;

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
    }
  });

  try {
    await client.login(DISCORD_TOKEN);
  } catch (error) {
    console.error("Discord Bot ログイン失敗:", error);
  }
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
    ];

    await client.application?.commands.set(commands);
    console.log("Discord Bot: スラッシュコマンドを登録しました");
  } catch (error) {
    console.error("コマンド登録エラー:", error);
  }
}
