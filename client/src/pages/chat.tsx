import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Menu, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { ModelSelector } from "@/components/model-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Message, Conversation } from "@shared/schema";
import { aiModels } from "@shared/schema";

interface FileAttachment {
  type: "image";
  url: string;
  name: string;
}

export default function ChatPage() {
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState(aiModels[0].id);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
      attachments,
    }: {
      userMessage: string;
      attachments?: FileAttachment[];
    }) => {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
        attachments,
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
          attachments,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "チャットリクエストが失敗しました");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let newConversationId: string | undefined = currentConversationId;

      if (!reader) {
        throw new Error("ストリームの読み取りに失敗しました");
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
      
      const errorMessage = error instanceof Error ? error.message : "メッセージの送信に失敗しました";
      
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Clear the loading state
      setStreamingMessage("");
      
      // Remove the user message if there was an error
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  const handleSend = (message: string, attachments?: FileAttachment[]) => {
    chatMutation.mutate({ userMessage: message, attachments });
  };

  const handleNewConversation = () => {
    setCurrentConversationId(undefined);
    setMessages([]);
    setStreamingMessage("");
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
  };

  return (
    <div className="flex h-screen">
      {sidebarOpen && (
        <div className="w-80 shrink-0">
          <ConversationSidebar
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
          />
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <header className="border-b bg-card">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                data-testid="button-toggle-sidebar"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">サイドバー切替</span>
              </Button>

              <h1 className="text-xl font-semibold" data-testid="text-app-title">
                AI Chat
              </h1>
              
              <ModelSelector
                value={selectedModel}
                onChange={setSelectedModel}
                disabled={chatMutation.isPending}
              />
            </div>

            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNewConversation}
                  data-testid="button-clear-chat"
                >
                  <Trash2 className="h-5 w-5" />
                  <span className="sr-only">新しい会話</span>
                </Button>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {messages.length === 0 && !streamingMessage && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 p-8">
                <h2 className="text-2xl font-semibold text-muted-foreground">
                  AIアシスタントへようこそ
                </h2>
                <p className="text-muted-foreground max-w-md">
                  メッセージを入力して会話を始めましょう。複数のAIモデルから選択でき、画像を添付することもできます。
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
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
              <div className="text-sm text-muted-foreground">考え中...</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        <footer className="border-t bg-card p-6">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSend={handleSend}
              disabled={chatMutation.isPending}
              placeholder="メッセージを入力... (Shift+Enterで改行)"
            />
          </div>
        </footer>
      </div>
    </div>
  );
}
