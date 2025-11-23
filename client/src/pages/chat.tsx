import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Menu, Trash2, Settings, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { ModelSelector } from "@/components/model-selector";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { AppSettings } from "@/components/app-settings";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/useLanguage";
import { queryClient } from "@/lib/queryClient";
import { localStorageManager } from "@/lib/localStorage";
import { cn } from "@/lib/utils";
import type { Message, Conversation } from "@shared/schema";
import { aiModels } from "@shared/schema";

export default function ChatPage() {
  const { t } = useLanguage();
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => {
    const settings = localStorageManager.getAppSettings();
    return settings.defaultModel || (aiModels.length > 0 ? aiModels[0].id : "google/gemini-2.5-flash");
  });
  const [editingMessageId, setEditingMessageId] = useState<string | undefined>();
  const [editingContent, setEditingContent] = useState("");
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [editingTitle, setEditingTitle] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [isTemporaryChat, setIsTemporaryChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const appSettings = localStorageManager.getAppSettings();

  const { data: currentConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", currentConversationId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${currentConversationId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch conversation");
      }
      return response.json();
    },
    enabled: !!currentConversationId,
  });

  useEffect(() => {
    if (currentConversation) {
      setMessages(currentConversation.messages);
      setSelectedModel(currentConversation.model);
      setCurrentConversationTitle(currentConversation.title);
    }
  }, [currentConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const chatMutation = useMutation({
    mutationFn: async ({
      userMessage,
    }: {
      userMessage: string;
    }) => {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Show loading immediately
      setStreamingMessage("...");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          model: selectedModel,
          conversationId: currentConversationId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || t("error"));
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let newConversationId: string | undefined = currentConversationId;

      if (!reader) {
        throw new Error(t("error"));
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              
              // Handle conversation ID (emitted early)
              if (parsed.conversationId && !newConversationId) {
                newConversationId = parsed.conversationId;
              }
              
              // Handle content from delta
              if (parsed.content) {
                fullText += parsed.content;
                setStreamingMessage(fullText);
              }
              
              // Handle error
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof Error) {
                throw e;
              }
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }

      if (!fullText) {
        throw new Error("AIからの応答がありませんでした");
      }

      return { fullText, conversationId: newConversationId };
    },
    onSuccess: ({ fullText, conversationId }) => {
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: fullText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingMessage("");
      
      if (conversationId && conversationId !== currentConversationId) {
        setCurrentConversationId(conversationId);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", conversationId],
        });
      }
    },
    onError: (error) => {
      console.error("Chat error:", error);
      
      const errorMessage = error instanceof Error ? error.message : t("error");
      
      toast({
        title: t("error"),
        description: errorMessage,
        variant: "destructive",
      });
      
      // Clear the loading state
      setStreamingMessage("");
      
      // Remove the user message if there was an error
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!currentConversationId) return;
    const updatedMessages = messages.map((msg) =>
      msg.id === messageId
        ? { ...msg, content: newContent, isEdited: true }
        : msg
    );
    setMessages(updatedMessages);
    const updated = await fetch(`/api/conversations/${currentConversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: updatedMessages }),
    });
    if (updated.ok) {
      const conv = await updated.json();
      localStorageManager.updateConversation(currentConversationId, conv);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversationId] });
      toast({ description: t("messageEdited") });
    }
    setEditingMessageId(undefined);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!currentConversationId) return;
    const updatedMessages = messages.filter((msg) => msg.id !== messageId);
    setMessages(updatedMessages);
    const updated = await fetch(`/api/conversations/${currentConversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: updatedMessages }),
    });
    if (updated.ok) {
      const conv = await updated.json();
      localStorageManager.updateConversation(currentConversationId, conv);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversationId] });
      toast({ description: t("messageDeleted") });
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    if (!currentConversationId) return;
    const updated = await fetch(`/api/conversations/${currentConversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    if (updated.ok) {
      const conv = await updated.json();
      setCurrentConversationTitle(newTitle);
      localStorageManager.updateConversation(currentConversationId, conv);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setEditingTitle(false);
      toast({ description: t("conversationUpdated") });
    }
  };

  const handleSend = (message: string) => {
    chatMutation.mutate({ userMessage: message });
  };

  const handleNewConversation = () => {
    setCurrentConversationId(undefined);
    setMessages([]);
    setStreamingMessage("");
    setIsTemporaryChat(false);
  };

  const handleTemporaryChat = () => {
    setCurrentConversationId(undefined);
    setMessages([]);
    setStreamingMessage("");
    setIsTemporaryChat(!isTemporaryChat);
    toast({
      description: isTemporaryChat
        ? "チャットを保存するモードに切り替えました"
        : "一時的なチャットを開始しました（保存されません）",
    });
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(240, Math.min(500, startWidth + diff));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="flex h-screen">
      {sidebarOpen && (
        <>
          <div ref={sidebarRef} style={{ width: `${sidebarWidth}px` }} className="shrink-0 flex flex-col">
            <div className="flex-1 flex flex-col">
              {!isTemporaryChat && (
                <ConversationSidebar
                  currentConversationId={currentConversationId}
                  onSelectConversation={handleSelectConversation}
                  onNewConversation={handleNewConversation}
                />
              )}
              {isTemporaryChat && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-muted-foreground text-sm">
                  <Clock className="h-8 w-8 mb-2 opacity-50" />
                  <p>一時的なチャット</p>
                  <p className="text-xs mt-1">
                    このチャットは保存されません
                  </p>
                </div>
              )}
            </div>
          </div>
          <div
            onMouseDown={handleMouseDown}
            className="w-1 bg-sidebar-border hover:bg-blue-500/50 cursor-col-resize transition-colors"
            data-testid="sidebar-resize-handle"
          />
        </>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <header className="border-b bg-gradient-to-r from-blue-400/70 via-purple-400/70 to-pink-400/70 backdrop-blur-sm shadow-lg transition-all duration-300 animate-gradient-flow bg-[length:200%_100%]">
          <div className="flex items-center justify-between px-6 py-4 animate-fade-in">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                data-testid="button-toggle-sidebar"
                className="text-white hover:bg-white/20"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">{t("toggleSidebar")}</span>
              </Button>

              {isTemporaryChat ? (
                <h1 className="text-xl font-semibold flex items-center gap-2 text-white">
                  <Clock className="h-5 w-5" />
                  {t("temporaryChat")}
                </h1>
              ) : editingTitle && currentConversationId ? (
                <Input
                  value={currentConversationTitle}
                  onChange={(e) => setCurrentConversationTitle(e.target.value)}
                  onBlur={() => handleUpdateTitle(currentConversationTitle)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdateTitle(currentConversationTitle);
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  autoFocus
                  className="max-w-xs"
                  data-testid="input-conversation-title"
                />
              ) : (
                <h1
                  className="text-xl font-semibold cursor-pointer hover:opacity-80 text-white transition-opacity"
                  onClick={() => currentConversationId && setEditingTitle(true)}
                  data-testid="text-conversation-title"
                >
                  {currentConversationTitle || "AI Chat"}
                </h1>
              )}
              
              <ModelSelector
                value={selectedModel}
                onChange={(model) => {
                  setSelectedModel(model);
                  const settings = localStorageManager.getAppSettings();
                  localStorageManager.saveAppSettings({ ...settings, defaultModel: model });
                }}
                disabled={chatMutation.isPending}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleTemporaryChat}
                title={isTemporaryChat ? t("switchToSave") : t("switchToTemporary")}
                data-testid="button-toggle-temporary-chat"
                className={cn("text-white hover:bg-white/20", isTemporaryChat ? "bg-white/30" : "")}
              >
                <Clock className="h-5 w-5" />
                <span className="sr-only">{t("temporaryChat")}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAppSettings(true)}
                data-testid="button-app-settings"
                className="text-white hover:bg-white/20 transition-transform duration-200"
              >
                <Settings className="h-5 w-5" />
                <span className="sr-only">{t("appSettings")}</span>
              </Button>
            </div>
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto bg-gradient-to-b from-blue-50 via-purple-50/30 to-pink-50 dark:from-blue-950/10 dark:via-purple-950/8 dark:to-pink-950/10"
          style={{
            fontSize: `${appSettings.fontSize}px`,
            lineHeight: {
              compact: "1.2",
              normal: "1.5",
              loose: "1.8",
            }[appSettings.lineHeight],
          }}
        >
          {messages.length === 0 && !streamingMessage && (
            <div className="flex items-center justify-center h-full animate-fade-in">
              <div className="text-center space-y-6 p-8 bg-gradient-to-br from-blue-100/60 via-purple-100/50 to-pink-100/60 dark:from-blue-900/30 dark:via-purple-900/25 dark:to-pink-900/30 rounded-2xl shadow-lg backdrop-blur-sm border border-purple-200/70 dark:border-purple-700/50 max-w-md">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-slide-in-bottom">
                  {isTemporaryChat ? t("temporaryChat") : t("welcomeMessage")}
                </h2>
                <p className="text-foreground max-w-md animate-slide-in-bottom [animation-delay:100ms] text-sm leading-relaxed">
                  {isTemporaryChat
                    ? t("temporaryDescription")
                    : t("welcomeDescription")}
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isOwn={true}
              onEdit={(msg) => {
                setEditingMessageId(msg.id);
                setEditingContent(msg.content);
              }}
              onDelete={handleDeleteMessage}
            />
          ))}

          {streamingMessage && (
            <ChatMessage
              message={{
                id: "streaming",
                role: "assistant",
                content: streamingMessage,
                timestamp: Date.now(),
              }}
            />
          )}

          {chatMutation.isPending && !streamingMessage && (
            <div className="flex gap-4 p-6 bg-muted/30">
              <div className="h-8 w-8 shrink-0 rounded-full bg-accent flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="text-sm text-muted-foreground">{t("thinking")}</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        <footer className="border-t bg-card p-6">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSend={handleSend}
              disabled={chatMutation.isPending}
              placeholder={t("messageInput")}
            />
          </div>
        </footer>
      </div>

      <AppSettings isOpen={showAppSettings} onClose={() => setShowAppSettings(false)} />
    </div>
  );
}
