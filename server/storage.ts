import { type Conversation, type Message } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getConversation(id: string): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string, model: string): Promise<Conversation>;
  updateConversation(id: string, messages: Message[]): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private conversations: Map<string, Conversation>;

  constructor() {
    this.conversations = new Map();
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getAllConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  async createConversation(title: string, model: string): Promise<Conversation> {
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

  async updateConversation(id: string, messages: Message[]): Promise<Conversation> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    conversation.messages = messages;
    conversation.updatedAt = Date.now();
    this.conversations.set(id, conversation);
    return conversation;
  }

  async deleteConversation(id: string): Promise<void> {
    this.conversations.delete(id);
  }
}

export const storage = new MemStorage();
