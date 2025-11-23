import { z } from "zod";

export const aiModels = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro Preview" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini" },
] as const;

export const aiSettingsSchema = z.object({
  customInstructions: z.string().optional(),
  nickname: z.string().optional(),
  role: z.string().optional(),
  memory: z.array(z.string()).optional(),
  memoryEnabled: z.boolean().optional(),
});

export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.number(),
  attachments: z.array(z.object({
    type: z.enum(["image", "file"]),
    url: z.string(),
    name: z.string(),
    mimeType: z.string().optional(),
    size: z.number().optional(),
  })).optional(),
  isEdited: z.boolean().optional(),
});

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  model: z.string(),
  messages: z.array(messageSchema),
  tags: z.array(z.string()).optional(),
  aiSettings: aiSettingsSchema.optional(),
  archived: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const chatRequestSchema = z.object({
  message: z.string(),
  model: z.string().optional().default("google/gemini-2.5-flash"),
  conversationId: z.string().optional(),
  attachments: z.array(z.object({
    type: z.enum(["image", "file"]),
    url: z.string(),
    name: z.string(),
    mimeType: z.string().optional(),
    size: z.number().optional(),
  })).optional(),
}).refine(
  (data) => data.message.trim().length > 0 || (data.attachments && data.attachments.length > 0),
  { message: "メッセージまたはファイルを入力してください" }
);

export type Message = z.infer<typeof messageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type AISettings = z.infer<typeof aiSettingsSchema>;
export type AIModel = typeof aiModels[number];
