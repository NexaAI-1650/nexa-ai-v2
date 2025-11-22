import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquare, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

interface ConversationSidebarProps {
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onSidebarResize?: (width: number) => void;
}

export function ConversationSidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });
  
  const [searchQuery, setSearchQuery] = useState("");

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/conversations/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("この会話を削除しますか？")) {
      deleteMutation.mutate(id);
      if (currentConversationId === id) {
        onNewConversation();
      }
    }
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.title.toLowerCase().includes(query) ||
      conv.messages.some(msg => msg.content.toLowerCase().includes(query))
    );
  }, [conversations, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <Button
          onClick={onNewConversation}
          className="w-full"
          data-testid="button-new-conversation"
        >
          <Plus className="h-4 w-4 mr-2" />
          新しい会話
        </Button>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="会話を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 py-2 h-9"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              className={cn(
                "w-full text-left p-3 rounded-md hover-elevate active-elevate-2 group flex items-center justify-between gap-2 transition-all",
                currentConversationId === conversation.id && "bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-600/20 border border-blue-500/30"
              )}
              data-testid={`conversation-${conversation.id}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-sidebar-foreground">
                    {conversation.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {conversation.messages.length} メッセージ
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={(e) => handleDelete(e, conversation.id)}
                data-testid={`button-delete-${conversation.id}`}
              >
                <Trash2 className="h-3 w-3" />
                <span className="sr-only">削除</span>
              </Button>
            </button>
          ))}
          
          {filteredConversations.length === 0 && conversations.length === 0 && (
            <div className="text-center p-8 text-muted-foreground text-sm">
              まだ会話がありません
            </div>
          )}
          
          {filteredConversations.length === 0 && conversations.length > 0 && (
            <div className="text-center p-8 text-muted-foreground text-sm">
              「{searchQuery}」に該当する会話がありません
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
