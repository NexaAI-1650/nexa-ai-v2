import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "メッセージを入力...",
  value: externalValue,
  onChange: externalOnChange,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [textareaHeight, setTextareaHeight] = useState(60);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageValue = externalValue !== undefined ? externalValue : message;
  
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 60), 200);
      setTextareaHeight(newHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [messageValue]);

  const handleChange = (val: string) => {
    if (externalValue === undefined) {
      setMessage(val);
    }
    externalOnChange?.(val);
  };

  const handleSend = () => {
    if (messageValue.trim() && !disabled) {
      onSend(messageValue.trim());
      if (externalValue === undefined) {
        setMessage("");
        setTextareaHeight(60);
      }
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
          ref={textareaRef}
          value={messageValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="resize-none focus-ring-interactive focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-background overflow-hidden"
          style={{ height: `${textareaHeight}px` }}
          data-testid="input-message"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !messageValue.trim()}
          size="icon"
          className="shrink-0 interactive-scale interactive-glow bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 hover:from-blue-600 hover:via-purple-600 hover:to-blue-700 active:from-blue-700 active:via-purple-700 active:to-blue-800 dark:active:shadow-lg dark:active:shadow-white/30 light:active:shadow-lg light:active:shadow-black/30 text-white shadow-lg transition-all"
          style={{ height: `${textareaHeight}px`, width: `${textareaHeight}px` }}
          data-testid="button-send"
        >
          <Send className="h-5 w-5" />
          <span className="sr-only">送信</span>
        </Button>
      </div>
    </div>
  );
}
