import type { Express } from "express";
import { createServer, type Server } from "http";
import { chatRequestSchema, ttsRequestSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  // Chat endpoint with streaming support
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, model, conversationHistory } = chatRequestSchema.parse(req.body);

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: "OpenRouter APIキーが設定されていません" });
      }

      // Build messages array for OpenRouter
      const messages = [
        ...(conversationHistory || []).map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: "user", content: message },
      ];

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

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
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API error:", errorText);
        res.write(`data: ${JSON.stringify({ error: "AI APIエラー" })}\n\n`);
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
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              console.error("Failed to parse OpenRouter chunk:", e);
            }
          }
        }
      }

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

  // TTS endpoint
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice } = ttsRequestSchema.parse(req.body);

      if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: "OpenAI APIキーが設定されていません" });
      }

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: voice,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI TTS error:", errorText);
        return res.status(response.status).json({ error: "音声生成に失敗しました" });
      }

      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

      res.json({ audioUrl });
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "音声生成エラー",
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
