import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "メッセージを入力...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-end">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[60px] max-h-[200px] resize-none focus-ring-interactive focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-background"
          data-testid="input-message"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          size="icon"
          className="h-[60px] w-[60px] shrink-0 interactive-scale interactive-glow bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 hover:from-blue-600 hover:via-purple-600 hover:to-blue-700 active:from-blue-700 active:via-purple-700 active:to-blue-800 dark:active:shadow-lg dark:active:shadow-white/30 light:active:shadow-lg light:active:shadow-black/30 text-white shadow-lg transition-all"
          data-testid="button-send"
        >
          <Send className="h-5 w-5" />
          <span className="sr-only">送信</span>
        </Button>
      </div>
    </div>
  );
}
