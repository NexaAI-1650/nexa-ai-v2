import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquare, Plus, Search, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/useLanguage";
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
  const { t } = useLanguage();
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

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/conversations/${id}`, { archived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(t("deleteConfirm"))) {
      deleteMutation.mutate(id);
      if (currentConversationId === id) {
        onNewConversation();
      }
    }
  };

  const handleArchive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    archiveMutation.mutate(id);
    if (currentConversationId === id) {
      onNewConversation();
    }
  };

  const handleRename = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) return;
    const newTitle = prompt(t("renameConversation"), conversation.title);
    if (newTitle && newTitle.trim()) {
      apiRequest("PATCH", `/api/conversations/${id}`, { title: newTitle.trim() }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      });
    }
  };

  const filteredConversations = useMemo(() => {
    const notArchived = conversations.filter(c => !c.archived);
    if (!searchQuery) return notArchived;
    const query = searchQuery.toLowerCase();
    return notArchived.filter(conv => 
      conv.title.toLowerCase().includes(query) ||
      conv.messages.some(msg => msg.content.toLowerCase().includes(query))
    );
  }, [conversations, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-purple-900/80 to-blue-900/80 dark:from-purple-950/90 dark:to-blue-950/90 border-r border-purple-500/30 dark:border-purple-800/50">
      <div className="p-4 border-b border-purple-500/20 dark:border-purple-800/30 space-y-3">
        <Button
          onClick={onNewConversation}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg font-semibold"
          data-testid="button-new-conversation"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("newConversation")}
        </Button>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/60" />
          <Input
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 py-2 h-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15 focus:border-white/40"
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
                "w-full text-left p-3 rounded-md hover:bg-white/10 active:bg-white/20 group flex items-center justify-between gap-2 transition-all text-white hover-elevate active-elevate-2",
                currentConversationId === conversation.id && "bg-gradient-to-r from-blue-500/60 to-purple-500/60 border border-white/30 shadow-lg"
              )}
              data-testid={`conversation-${conversation.id}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <MessageSquare className="h-4 w-4 shrink-0 text-white/80" />
                <p className="text-sm font-medium truncate text-white">
                  {conversation.title}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-white/20 rounded p-0 flex items-center justify-center"
                    data-testid={`button-menu-${conversation.id}`}
                  >
                    <MoreVertical className="h-3 w-3 text-white" />
                    <span className="sr-only">メニュー</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => handleRename(e as any, conversation.id)}
                    data-testid={`menu-rename-${conversation.id}`}
                  >
                    {t("rename")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => handleArchive(e as any, conversation.id)}
                    data-testid={`menu-archive-${conversation.id}`}
                  >
                    {t("archive")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => handleDelete(e as any, conversation.id)}
                    data-testid={`menu-delete-${conversation.id}`}
                    className="text-destructive"
                  >
                    {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </button>
          ))}
          
          {filteredConversations.length === 0 && conversations.length === 0 && (
            <div className="text-center p-8 text-white/60 text-sm">
              {t("noConversations")}
            </div>
          )}
          
          {filteredConversations.length === 0 && conversations.length > 0 && (
            <div className="text-center p-8 text-white/60 text-sm">
              {t("noResults")} "{searchQuery}"
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
