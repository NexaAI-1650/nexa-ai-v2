import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { chatRequestSchema } from "@shared/schema";
import { storage } from "./storage";
import { restartDiscordBot, shutdownDiscordBot, getBotStatus, startDiscordBot, getBotChatStats, getMemoryShareEnabled, setMemoryShareEnabled, getCurrentModel, setCurrentModel, getRateLimit, setRateLimit, registerSlashCommands, getAllGuildSettings, getAvailableGuildsExport, isGuildAdminAllowed } from "./discord-bot";
import { Client, GatewayIntentBits } from "discord.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; avatar?: string; discriminator: string };
    }
  }
}

async function getDiscordConnection() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? "repl " + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? "depl " + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error("Discord connection not available");
  }

  const response = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=discord",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    }
  );
  
  const data = await response.json();
  const connection = data.items?.[0];
  
  if (!connection) {
    throw new Error("Discord connection not found");
  }
  
  return connection;
}

async function getDiscordAccessToken() {
  const connection = await getDiscordConnection();
  const accessToken = connection?.settings?.access_token || connection?.settings?.oauth?.credentials?.access_token;
  
  if (!accessToken) {
    throw new Error("Discord access token not found");
  }
  
  return accessToken;
}

async function getDiscordOAuthCredentials() {
  const clientId = process.env.DISCORD_OAUTH_CLIENT_ID;
  const clientSecret = process.env.DISCORD_OAUTH_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error(
      "Discord OAuth credentials not configured. Please set DISCORD_OAUTH_CLIENT_ID and DISCORD_OAUTH_CLIENT_SECRET environment variables. " +
      "Get them from https://discord.com/developers/applications"
    );
  }
  
  return { clientId, clientSecret };
}

export async function registerRoutes(app: Express): Promise<Server> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  // Get all conversations
  app.get("/api/conversations", async (_req, res) => {
    try {
      const conversations = await storage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "会話の取得に失敗しました",
      });
    }
  });

  // Get specific conversation
  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "会話が見つかりません" });
      }
      res.json(conversation);
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "会話の取得に失敗しました",
      });
    }
  });

  // Update conversation (PATCH - for messages, title, settings, archived, model)
  app.patch("/api/conversations/:id", async (req, res) => {
    try {
      const { messages, title, settings, archived, model } = req.body;
      let conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "会話が見つかりません" });
      }

      if (messages) {
        conversation = await storage.updateConversationMessages(req.params.id, messages);
      }
      if (title) {
        conversation = await storage.updateConversationTitle(req.params.id, title);
      }
      if (settings) {
        conversation = await storage.updateConversationSettings(req.params.id, settings);
      }
      if (model) {
        conversation = { ...conversation, model };
        await storage.updateConversation(req.params.id, conversation);
      }
      if (archived !== undefined) {
        conversation = { ...conversation, archived };
        await storage.updateConversation(req.params.id, conversation);
      }

      res.json(conversation);
    } catch (error) {
      console.error("Update conversation error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "会話の更新に失敗しました",
      });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      await storage.deleteConversation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete conversation error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "会話の削除に失敗しました",
      });
    }
  });

  // Chat endpoint with streaming support
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, model, conversationId, attachments } = chatRequestSchema.parse(req.body);

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: "OpenRouter APIキーが設定されていません" });
      }

      // Set up SSE headers FIRST (before any res.write)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Get or create conversation
      let conversation = conversationId 
        ? await storage.getConversation(conversationId)
        : null;

      if (!conversation) {
        let title: string;
        if (message && message.trim()) {
          title = message.slice(0, 50) + (message.length > 50 ? "..." : "");
        } else if (attachments && attachments.length > 0) {
          title = "画像添付会話";
        } else {
          title = "新しい会話";
        }
        conversation = await storage.createConversation(title, model);
      }
      
      // Send conversation ID early
      res.write(`data: ${JSON.stringify({ conversationId: conversation.id })}\n\n`);

      // Build messages for OpenRouter
      const conversationMessages = conversation.messages || [];
      const messages = [
        ...conversationMessages.map((msg) => {
          // If message has attachments, format for vision models
          if (msg.attachments && msg.attachments.length > 0) {
            const contentParts: any[] = [];
            
            if (msg.content) {
              contentParts.push({ type: "text", text: msg.content });
            }
            
            msg.attachments.forEach((att) => {
              if (att.type === "image" && att.url) {
                contentParts.push({
                  type: "image_url",
                  image_url: { 
                    url: att.url,
                    detail: "auto"
                  },
                });
              } else if (att.type === "file" && att.url) {
                // For non-image files, include as text attachment indicator
                contentParts.push({
                  type: "text",
                  text: `[添付ファイル: ${att.name}]`,
                });
              }
            });
            
            return {
              role: msg.role,
              content: contentParts,
            };
          }
          
          return { role: msg.role, content: msg.content };
        }),
      ];

      // Add new user message
      if (attachments && attachments.length > 0) {
        const contentParts: any[] = [];
        
        if (message) {
          contentParts.push({ type: "text", text: message });
        }
        
        attachments.forEach((att) => {
          if (att.type === "image" && att.url) {
            contentParts.push({
              type: "image_url",
              image_url: { 
                url: att.url,
                detail: "auto"
              },
            });
          } else if (att.type === "file" && att.url) {
            // For non-image files, include as text attachment indicator
            contentParts.push({
              type: "text",
              text: `[添付ファイル: ${att.name}]`,
            });
          }
        });
        
        messages.push({
          role: "user",
          content: contentParts,
        });
      } else {
        messages.push({ role: "user", content: message });
      }

      // Call OpenRouter API with streaming
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.REPL_SLUG || "http://localhost:5000",
          "X-Title": "AI Chat",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API error:", response.status, errorText);
        let errorMessage = "AI APIエラー";
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch (e) {
          // Use default error message
        }
        
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        res.write(`data: ${JSON.stringify({ error: "ストリームの読み取りに失敗" })}\n\n`);
        res.end();
        return;
      }

      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              res.write("data: [DONE]\n\n");
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              console.error("Failed to parse OpenRouter chunk:", e);
            }
          }
        }
      }

      // Save conversation
      const userMessage = {
        id: `user-${Date.now()}`,
        role: "user" as const,
        content: message || "",
        timestamp: Date.now(),
        attachments,
      };

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant" as const,
        content: fullText,
        timestamp: Date.now(),
      };

      await storage.updateConversation(conversation.id, {
        ...conversation,
        messages: [
          ...(conversation.messages || []),
          userMessage,
          assistantMessage,
        ],
      });

      res.end();
    } catch (error) {
      console.error("Chat error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: error instanceof Error ? error.message : "チャットエラー",
        });
      }
    }
  });

  // Admin endpoints
  app.get("/api/admin/bot-status", (_req, res) => {
    try {
      const status = getBotStatus();
      res.json(status);
    } catch (error) {
      console.error("Bot status error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "ステータス取得に失敗しました",
      });
    }
  });

  app.post("/api/admin/bot-restart", async (_req, res) => {
    try {
      await restartDiscordBot();
      res.json({ success: true, message: "Botを再起動しました" });
    } catch (error) {
      console.error("Bot restart error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "再起動に失敗しました",
      });
    }
  });

  app.post("/api/admin/bot-shutdown", async (_req, res) => {
    try {
      await shutdownDiscordBot();
      res.json({ success: true, message: "Botをシャットダウンしました" });
    } catch (error) {
      console.error("Bot shutdown error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "シャットダウンに失敗しました",
      });
    }
  });

  app.post("/api/admin/bot-start", async (_req, res) => {
    try {
      await startDiscordBot();
      res.json({ success: true, message: "Botを起動しました" });
    } catch (error) {
      console.error("Bot start error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "起動に失敗しました",
      });
    }
  });

  app.get("/api/admin/bot-stats", async (_req, res) => {
    try {
      const botStats = getBotChatStats();
      res.json({
        totalChats: botStats.totalChats,
        totalMessages: botStats.totalMessages,
        totalTokens: botStats.totalTokens,
        modelCount: Object.keys(botStats.modelCounts).length,
      });
    } catch (error) {
      console.error("Bot stats error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "統計取得に失敗しました",
      });
    }
  });

  app.get("/api/admin/bot-models", async (_req, res) => {
    try {
      const botStats = getBotChatStats();
      res.json(botStats.modelCounts);
    } catch (error) {
      console.error("Bot models error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "モデル情報取得に失敗しました",
      });
    }
  });

  // Discord Auth endpoints
  app.get("/api/auth/me", async (req: Request, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      res.json(req.user);
    } catch (error) {
      console.error("Auth me error:", error);
      res.status(500).json({ error: "認証情報取得に失敗しました" });
    }
  });

  app.get("/api/auth/logout", (_req, res) => {
    _req.session?.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/discord", async (req: Request, res) => {
    try {
      const { clientId } = await getDiscordOAuthCredentials();
      const redirectUri = "http://localhost:5000/api/auth/callback";
      
      console.log("Auth discord - redirectUri:", redirectUri);
      
      const authUrl = new URL("https://discord.com/oauth2/authorize");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "identify email guilds");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      
      console.log("Auth discord - authUrl:", authUrl.toString());
      res.json({ authUrl: authUrl.toString() });
    } catch (error) {
      console.error("Auth Discord error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "認証URL生成に失敗しました" });
    }
  });

  app.get("/api/auth/callback", async (req: Request, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.redirect("/admin?error=no_code");
      }

      const { clientId, clientSecret } = await getDiscordOAuthCredentials();
      const redirectUri = "http://localhost:5000/api/auth/callback";
      
      console.log("Auth callback - code:", code);
      console.log("Auth callback - redirectUri:", redirectUri);

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        return res.status(400).json({ error: "token_exchange_failed", details: errorText });
      }

      const tokenData = await tokenResponse.json();
      console.log("Auth callback - got token:", { access_token: tokenData.access_token?.substring(0, 10) + "..." });
      
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error("User fetch failed:", errorText);
        return res.status(400).json({ error: "user_fetch_failed", details: errorText });
      }

      const userData = await userResponse.json();
      console.log("Auth callback - got user data:", userData.id, userData.username);

      req.session!.userId = userData.id;
      req.session!.username = userData.username;
      req.session!.avatar = userData.avatar;
      req.session!.accessToken = tokenData.access_token;

      req.session!.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "session_save_failed", details: err.message });
        }
        console.log("Auth callback - session saved, redirecting to /admin");
        res.redirect("/admin");
      });
    } catch (error) {
      console.error("Auth callback error:", error);
      res.status(500).json({ error: "callback_error", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/admin/my-guilds", async (req: Request, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const accessToken = await getDiscordAccessToken();
      const client = new Client({
        intents: [GatewayIntentBits.Guilds],
      });
      await client.login(accessToken);

      const userGuilds = await client.rest.get("/users/@me/guilds");
      const botGuilds = getAvailableGuildsExport();
      
      const adminGuilds = (userGuilds as any[])
        .filter((ug: any) => (ug.permissions & 8) === 8) // ADMINISTRATOR permission
        .filter((ug: any) => botGuilds.some((bg) => bg.guildId === ug.id))
        .filter((ug: any) => isGuildAdminAllowed(ug.id));

      await client.destroy();
      res.json({ guilds: adminGuilds });
    } catch (error) {
      console.error("My guilds error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "管理サーバー取得に失敗しました",
      });
    }
  });

  app.get("/api/admin/guilds", async (_req, res) => {
    try {
      const guilds = getAvailableGuildsExport().filter(guild => isGuildAdminAllowed(guild.guildId));
      res.json({ guilds });
    } catch (error) {
      console.error("Guilds get error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "サーバー情報取得に失敗しました",
      });
    }
  });

  app.get("/api/admin/memory-share", async (req, res) => {
    try {
      const guildId = req.query.guildId as string | undefined;
      if (!guildId || !isGuildAdminAllowed(guildId)) {
        return res.status(403).json({ error: "このサーバーの管理権限がありません" });
      }
      res.json({ enabled: getMemoryShareEnabled(guildId) });
    } catch (error) {
      console.error("Memory share get error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "設定取得に失敗しました",
      });
    }
  });

  app.post("/api/admin/memory-share", async (req, res) => {
    try {
      const { enabled, guildId } = req.body;
      if (!guildId || !isGuildAdminAllowed(guildId)) {
        return res.status(403).json({ error: "このサーバーの管理権限がありません" });
      }
      setMemoryShareEnabled(enabled, guildId);
      res.json({ success: true, enabled });
    } catch (error) {
      console.error("Memory share set error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "設定変更に失敗しました",
      });
    }
  });

  app.get("/api/admin/bot-current-model", async (req, res) => {
    try {
      const guildId = req.query.guildId as string | undefined;
      if (!guildId || !isGuildAdminAllowed(guildId)) {
        return res.status(403).json({ error: "このサーバーの管理権限がありません" });
      }
      res.json({ model: getCurrentModel(guildId) });
    } catch (error) {
      console.error("Bot current model error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "モデル情報取得に失敗しました",
      });
    }
  });

  app.post("/api/admin/bot-current-model", async (req, res) => {
    try {
      const { model, guildId } = req.body;
      if (!guildId || !isGuildAdminAllowed(guildId)) {
        return res.status(403).json({ error: "このサーバーの管理権限がありません" });
      }
      setCurrentModel(model, guildId);
      res.json({ success: true, model });
    } catch (error) {
      console.error("Bot current model set error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "モデル変更に失敗しました",
      });
    }
  });

  app.get("/api/admin/rate-limit", async (req, res) => {
    try {
      const guildId = req.query.guildId as string | undefined;
      if (!guildId || !isGuildAdminAllowed(guildId)) {
        return res.status(403).json({ error: "このサーバーの管理権限がありません" });
      }
      res.json({ limit: getRateLimit(guildId) });
    } catch (error) {
      console.error("Rate limit get error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "レート制限取得に失敗しました",
      });
    }
  });

  app.post("/api/admin/rate-limit", async (req, res) => {
    try {
      const { limit, guildId } = req.body;
      if (!guildId || !isGuildAdminAllowed(guildId)) {
        return res.status(403).json({ error: "このサーバーの管理権限がありません" });
      }
      setRateLimit(limit, guildId);
      res.json({ success: true, limit: getRateLimit(guildId) });
    } catch (error) {
      console.error("Rate limit set error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "レート制限設定に失敗しました",
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
