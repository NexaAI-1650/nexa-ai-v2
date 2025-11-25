import {
  type Conversation,
  type Message,
  type BotEventLog,
  type BotMetrics,
  type ModerationSettings,
  moderationSettingsSchema,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getConversation(id: string): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string, model: string): Promise<Conversation>;
  updateConversation(
    id: string,
    conversation: Conversation,
  ): Promise<Conversation>;
  updateConversationMessages(
    id: string,
    messages: Message[],
  ): Promise<Conversation>;
  updateConversationTags(id: string, tags: string[]): Promise<Conversation>;
  updateConversationTitle(id: string, title: string): Promise<Conversation>;
  updateConversationSettings(id: string, settings: any): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;
  addEventLog(log: Omit<BotEventLog, "id">): Promise<BotEventLog>;
  getEventLogs(limit?: number): Promise<BotEventLog[]>;
  addMetrics(
    metrics: Omit<BotMetrics, "timestamp"> & { timestamp?: number },
  ): Promise<BotMetrics>;
  getMetrics(limit?: number): Promise<BotMetrics[]>;
  getModerationSettings(guildId: string): Promise<ModerationSettings>;
  updateModerationSettings(
    guildId: string,
    settings: Partial<ModerationSettings>,
  ): Promise<ModerationSettings>;
}

export class MemStorage implements IStorage {
  private conversations: Map<string, Conversation>;
  private eventLogs: BotEventLog[] = [];
  private metrics: BotMetrics[] = [];
  private moderationSettings: Map<string, ModerationSettings> = new Map();

  constructor() {
    this.conversations = new Map();
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getAllConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  async createConversation(
    title: string,
    model: string,
  ): Promise<Conversation> {
    const id = randomUUID();
    const now = Date.now();
    const conversation: Conversation = {
      id,
      title,
      model,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(
    id: string,
    conversation: Conversation,
  ): Promise<Conversation> {
    const existing = this.conversations.get(id);
    if (!existing) {
      throw new Error("Conversation not found");
    }
    conversation.updatedAt = Date.now();
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversationTags(
    id: string,
    tags: string[],
  ): Promise<Conversation> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    conversation.tags = tags;
    conversation.updatedAt = Date.now();
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversationMessages(
    id: string,
    messages: Message[],
  ): Promise<Conversation> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    conversation.messages = messages;
    conversation.updatedAt = Date.now();
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversationTitle(
    id: string,
    title: string,
  ): Promise<Conversation> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    conversation.title = title;
    conversation.updatedAt = Date.now();
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversationSettings(
    id: string,
    settings: any,
  ): Promise<Conversation> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    conversation.aiSettings = { ...conversation.aiSettings, ...settings };
    conversation.updatedAt = Date.now();
    this.conversations.set(id, conversation);
    return conversation;
  }

  async deleteConversation(id: string): Promise<void> {
    this.conversations.delete(id);
  }

  async addEventLog(log: Omit<BotEventLog, "id">): Promise<BotEventLog> {
    const eventLog: BotEventLog = {
      ...log,
      id: randomUUID(),
    };
    this.eventLogs.push(eventLog);
    // Keep only last 1000 logs
    if (this.eventLogs.length > 1000) {
      this.eventLogs = this.eventLogs.slice(-1000);
    }
    return eventLog;
  }

  async getEventLogs(limit: number = 50): Promise<BotEventLog[]> {
    return this.eventLogs.slice(-limit).reverse();
  }

  async addMetrics(
    metrics: Omit<BotMetrics, "timestamp"> & { timestamp?: number },
  ): Promise<BotMetrics> {
    const metricsData: BotMetrics = {
      ...metrics,
      timestamp: metrics.timestamp || Date.now(),
    };
    this.metrics.push(metricsData);
    // Keep only last 500 data points
    if (this.metrics.length > 500) {
      this.metrics = this.metrics.slice(-500);
    }
    return metricsData;
  }

  async getMetrics(limit: number = 100): Promise<BotMetrics[]> {
    return this.metrics.slice(-limit);
  }

  async getModerationSettings(guildId: string): Promise<ModerationSettings> {
    if (!this.moderationSettings.has(guildId)) {
      const defaultSettings = moderationSettingsSchema.parse({
        guildId,
        enabled: true,
        lowTimeoutMinutes: 30,
        mediumAction: "kick",
        mediumTimeoutMinutes: 60,
        highAction: "ban",
        keywords: [
          "スパム",
          "詐欺",
          "売買",
          "エロ",
          "ポルノ",
          "違法",
          "薬物",
          "spam",
          "scam",
          "porn",
          "xxx",
          "illegal",
          "drugs",
        ],
      });
      this.moderationSettings.set(guildId, defaultSettings);
    }
    return this.moderationSettings.get(guildId)!;
  }

  async updateModerationSettings(
    guildId: string,
    settings: Partial<ModerationSettings>,
  ): Promise<ModerationSettings> {
    const existing = await this.getModerationSettings(guildId);
    const updated = moderationSettingsSchema.parse({
      ...existing,
      ...settings,
      guildId,
    });
    this.moderationSettings.set(guildId, updated);
    return updated;
  }
}

export const storage = new MemStorage();
