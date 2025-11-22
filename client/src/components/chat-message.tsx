import { Bot, User, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: Message;
  onPlayAudio?: (audioUrl: string) => void;
  isPlaying?: boolean;
}

export function ChatMessage({ message, onPlayAudio, isPlaying }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-4 p-6",
        isUser ? "bg-background" : "bg-muted/30"
      )}
      data-testid={`message-${message.id}`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            {isUser ? "あなた" : "AI アシスタント"}
          </span>
          {!isUser && message.audioUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPlayAudio?.(message.audioUrl!)}
              data-testid={`button-play-audio-${message.id}`}
            >
              <Volume2 className={cn("h-4 w-4", isPlaying && "text-primary")} />
              <span className="sr-only">音声を再生</span>
            </Button>
          )}
        </div>
        
        <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
}
