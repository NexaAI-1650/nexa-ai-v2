import type { Express } from "express";
import { createServer, type Server } from "http";
import { chatRequestSchema } from "@shared/schema";
import { storage } from "./storage";

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
      const messages = [
        ...conversation.messages.map((msg) => {
          // If message has attachments, format for vision models
          if (msg.attachments && msg.attachments.length > 0) {
            const contentParts: any[] = [];
            
            if (msg.content) {
              contentParts.push({ type: "text", text: msg.content });
            }
            
            msg.attachments.forEach((att) => {
              contentParts.push({
                type: "image_url",
                image_url: { 
                  url: att.url,
                  detail: "auto"
                },
              });
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
          contentParts.push({
            type: "image_url",
            image_url: { 
              url: att.url,
              detail: "auto"
            },
          });
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

      await storage.updateConversation(conversation.id, [
        ...conversation.messages,
        userMessage,
        assistantMessage,
      ]);

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

  const httpServer = createServer(app);

  return httpServer;
}
