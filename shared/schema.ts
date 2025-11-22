import { z } from "zod";

export const aiModels = [
  { id: "google/gemini-pro-1.5", name: "Gemini 1.5 Pro" },
  { id: "openai/gpt-4.5-preview", name: "GPT-4.5 Preview" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B" },
] as const;

export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.number(),
  audioUrl: z.string().optional(),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1, "メッセージを入力してください"),
  model: z.string(),
  conversationHistory: z.array(messageSchema).optional(),
});

export const ttsRequestSchema = z.object({
  text: z.string(),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).default("nova"),
});

export type Message = z.infer<typeof messageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type TTSRequest = z.infer<typeof ttsRequestSchema>;
export type AIModel = typeof aiModels[number];
