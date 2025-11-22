import type { Conversation } from "@shared/schema";

const CONVERSATIONS_KEY = "ai_chat_conversations";

export const localStorageManager = {
  getConversations(): Conversation[] {
    try {
      const stored = localStorage.getItem(CONVERSATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveConversations(conversations: Conversation[]): void {
    try {
      // Remove attachments URLs to save storage space (Base64 URLs are large)
      // Keep only metadata
      const sanitized = conversations.map(conv => ({
        ...conv,
        messages: conv.messages.map(msg => ({
          ...msg,
          attachments: msg.attachments?.map(att => ({
            type: att.type,
            name: att.name,
            mimeType: att.mimeType,
            size: att.size,
            url: '', // Clear the Base64 URL
          })),
        })),
      }));
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.error("Failed to save conversations to localStorage:", e);
    }
  },

  getConversation(id: string): Conversation | undefined {
    const conversations = this.getConversations();
    return conversations.find((c) => c.id === id);
  },

  addConversation(conversation: Conversation): void {
    const conversations = this.getConversations();
    conversations.unshift(conversation);
    this.saveConversations(conversations);
  },

  updateConversation(id: string, conversation: Conversation): void {
    const conversations = this.getConversations();
    const index = conversations.findIndex((c) => c.id === id);
    if (index >= 0) {
      conversations[index] = conversation;
      this.saveConversations(conversations);
    }
  },

  deleteConversation(id: string): void {
    const conversations = this.getConversations();
    this.saveConversations(conversations.filter((c) => c.id !== id));
  },

  clearAll(): void {
    localStorage.removeItem(CONVERSATIONS_KEY);
  },

  syncFromServer(serverConversations: Conversation[]): void {
    const local = this.getConversations();
    const merged = serverConversations.map((serverConv) => {
      const localConv = local.find((c) => c.id === serverConv.id);
      return localConv && localConv.updatedAt > serverConv.updatedAt ? localConv : serverConv;
    });
    this.saveConversations(merged);
  },
};
