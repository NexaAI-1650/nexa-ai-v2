import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
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
        </div>
        
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {message.attachments.map((attachment, index) => (
              <img
                key={index}
                src={attachment.url}
                alt={attachment.name}
                className="max-w-xs rounded-md border"
                data-testid={`message-attachment-${index}`}
              />
            ))}
          </div>
        )}
        
        <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
}
