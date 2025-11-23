import { Bot, User, Edit2, Copy, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@shared/schema";
import { cn } from "@/lib/utils";
import { aiModels } from "@shared/schema";

interface ChatMessageProps {
  message: Message;
  isOwn?: boolean;
  onEdit?: (message: Message) => void;
  model?: string;
}

export function ChatMessage({ message, isOwn = false, onEdit, model }: ChatMessageProps) {
  const isUser = message.role === "user";
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast({ description: "コピーしました" });
  };

  const modelName = model ? aiModels.find(m => m.id === model)?.name : undefined;

  return (
    <div
      className={cn(
        "flex gap-4 p-6 group animate-slide-in-bottom transition-all duration-300",
        isUser ? "bg-background" : "bg-muted/30 dark:bg-muted/30"
      )}
      data-testid={`message-${message.id}`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2 justify-between">
          <span className="font-semibold text-sm">
            {isUser ? "あなた" : "AI アシスタント"}
            {message.isEdited && <span className="text-xs text-muted-foreground">(編集済み)</span>}
          </span>
          {isOwn && isUser && onEdit && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => onEdit(message)}
                data-testid={`button-edit-${message.id}`}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        
        {message.attachments && message.attachments.length > 0 && (
          <div className="space-y-2">
            {/* Images */}
            {message.attachments
              .filter((a) => a.type === "image")
              .map((attachment, index) => (
                <img
                  key={`image-${index}`}
                  src={attachment.url}
                  alt={attachment.name}
                  className="max-w-xs rounded-lg border border-muted/30 animate-slide-in-bottom"
                  data-testid={`message-attachment-image-${index}`}
                />
              ))}
            
            {/* Files */}
            {message.attachments
              .filter((a) => a.type === "file")
              .map((attachment, index) => (
                <a
                  key={`file-${index}`}
                  href={attachment.url}
                  download={attachment.name}
                  className="inline-flex items-center gap-2 p-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg transition-colors animate-slide-in-bottom group"
                  data-testid={`message-attachment-file-${index}`}
                >
                  <span className="text-primary">📎</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {attachment.name}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground ml-2">⬇️</span>
                </a>
              ))}
          </div>
        )}
        
        <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {!isUser && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleCopy}
              data-testid={`button-copy-${message.id}`}
            >
              <Copy className="h-3 w-3" />
            </Button>
            {modelName && (
              <DropdownMenu>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  data-testid={`button-message-menu-${message.id}`}
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
                <DropdownMenuContent align="end" side="left">
                  <DropdownMenuItem disabled className="text-xs">
                    {modelName}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
