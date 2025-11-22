import { z } from "zod";

export const aiModels = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
] as const;

export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.number(),
  attachments: z.array(z.object({
    type: z.enum(["image"]),
    url: z.string(),
    name: z.string(),
  })).optional(),
});

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  model: z.string(),
  messages: z.array(messageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const chatRequestSchema = z.object({
  message: z.string(),
  model: z.string(),
  conversationId: z.string().optional(),
  attachments: z.array(z.object({
    type: z.enum(["image"]),
    url: z.string(),
    name: z.string(),
  })).optional(),
}).refine(
  (data) => data.message.trim().length > 0 || (data.attachments && data.attachments.length > 0),
  { message: "メッセージまたは画像を入力してください" }
);

export type Message = z.infer<typeof messageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type AIModel = typeof aiModels[number];
