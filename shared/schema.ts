import { z } from "zod";

export const aiModels = [
  { id: "openai/gpt-oss-20b:free", name: "gpt-oss-20b" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "openai/gpt-4o-mini", name: "GPT-4.1 Mini" },
  { id: "openai/o4-mini-high", name: "O4 Mini High" },
] as const;

export const botEventLogSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  type: z.enum(["info", "warning", "error"]),
  message: z.string(),
  guildId: z.string().optional(),
});

export const botMetricsSchema = z.object({
  timestamp: z.number(),
  responseTime: z.number(),
  errorCount: z.number(),
  successCount: z.number(),
  totalRequests: z.number(),
  averageResponseTime: z.number(),
});

export type BotEventLog = z.infer<typeof botEventLogSchema>;
export type BotMetrics = z.infer<typeof botMetricsSchema>;

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

export const moderationSettingsSchema = z.object({
  guildId: z.string(),
  enabled: z.boolean().default(true),
  lowTimeoutMinutes: z.number().default(30),
  mediumAction: z.enum(["timeout", "kick"]).default("kick"),
  mediumTimeoutMinutes: z.number().default(60),
  highAction: z.enum(["kick", "ban"]).default("ban"),
  keywords: z.array(z.string()).default([
    "スパム", "詐欺", "売買", "エロ", "ポルノ", "違法", "薬物",
    "spam", "scam", "porn", "xxx", "illegal", "drugs"
  ]),
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
  model: z.string().optional().default("openai/gpt-oss-20b:free"),
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
export type ModerationSettings = z.infer<typeof moderationSettingsSchema>;
