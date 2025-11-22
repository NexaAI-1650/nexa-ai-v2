import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { ModelSelector } from "@/components/model-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Message } from "@shared/schema";
import { aiModels } from "@shared/schema";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState(aiModels[0].id);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          model: selectedModel,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        throw new Error("チャットリクエストが失敗しました");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
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
                if (parsed.content) {
                  fullText += parsed.content;
                  setStreamingMessage(fullText);
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", e);
              }
            }
          }
        }
      }

      return fullText;
    },
    onSuccess: async (assistantText) => {
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantText,
        timestamp: Date.now(),
      };

      try {
        const audioResponse = await apiRequest("POST", "/api/tts", {
          text: assistantText,
          voice: "nova",
        });
        assistantMsg.audioUrl = audioResponse.audioUrl;
      } catch (error) {
        console.error("TTS generation failed:", error);
      }

      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingMessage("");
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "メッセージの送信に失敗しました",
        variant: "destructive",
      });
      setStreamingMessage("");
    },
  });

  const handleSend = (message: string) => {
    chatMutation.mutate(message);
  };

  const handleClearChat = () => {
    setMessages([]);
    setStreamingMessage("");
    setCurrentAudioUrl(null);
  };

  const handlePlayAudio = (audioUrl: string) => {
    if (audioRef.current) {
      if (currentAudioUrl === audioUrl && !audioRef.current.paused) {
        audioRef.current.pause();
        setCurrentAudioUrl(null);
      } else {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setCurrentAudioUrl(audioUrl);
      }
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => setCurrentAudioUrl(null);
      audio.addEventListener("ended", handleEnded);
      return () => audio.removeEventListener("ended", handleEnded);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
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
                onClick={handleClearChat}
                data-testid="button-clear-chat"
              >
                <Trash2 className="h-5 w-5" />
                <span className="sr-only">チャットをクリア</span>
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
                メッセージを入力して会話を始めましょう。複数のAIモデルから選択できます。
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onPlayAudio={handlePlayAudio}
            isPlaying={currentAudioUrl === message.audioUrl}
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
            <div className="text-sm text-muted-foreground">
              考え中...
            </div>
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

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
