import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquare, Plus, Search, MoreVertical, Copy, Download, Archive, Trash2, PencilIcon } from "lucide-react";
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
import { useState, useMemo, useCallback } from "react";

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

  const handleDelete = useCallback((convId: string) => {
    if (confirm(t("deleteConfirm"))) {
      deleteMutation.mutate(convId);
    }
  }, [deleteMutation, t]);

  const handleArchive = useCallback((convId: string) => {
    archiveMutation.mutate(convId);
  }, [archiveMutation]);

  const handleRename = useCallback((convId: string) => {
    const conversation = conversations.find(c => c.id === convId);
    if (!conversation) return;
    const newTitle = prompt(t("renameConversation"), conversation.title);
    if (newTitle && newTitle.trim()) {
      apiRequest("PATCH", `/api/conversations/${convId}`, { title: newTitle.trim() }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      });
    }
  }, [conversations, t]);

  const handleDuplicate = useCallback((convId: string) => {
    const conversation = conversations.find(c => c.id === convId);
    if (!conversation) return;
    const newTitle = conversation.title + " (コピー)";
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        messages: conversation.messages || [],
        model: conversation.model || "google/gemini-2.5-flash",
      }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    }).catch(err => {
      console.error("複製エラー:", err);
    });
  }, [conversations]);

  const handleExport = useCallback((convId: string) => {
    const conversation = conversations.find(c => c.id === convId);
    if (!conversation) return;
    const content = conversation.messages.map(msg => `${msg.role}: ${msg.content}`).join("\n\n");
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conversation.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [conversations]);

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
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <Button
          onClick={onNewConversation}
          className="w-full"
          data-testid="button-new-conversation"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("newConversation")}
        </Button>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 py-2 h-9"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredConversations.map((conversation) => {
            const convId = conversation.id;
            return (
              <div
                key={convId}
                onClick={() => onSelectConversation(convId)}
                className={cn(
                  "w-full text-left p-3 rounded-md hover-elevate active-elevate-2 group flex items-center justify-between gap-2 transition-all cursor-pointer",
                  currentConversationId === convId && "bg-sidebar-accent"
                )}
                data-testid={`conversation-${convId}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm font-medium text-sidebar-foreground" title={conversation.title || "無題のチャット"} style={{
                    maxWidth: "180px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                    {conversation.title || "無題のチャット"}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`button-menu-${convId}`}
                    >
                      <MoreVertical className="h-3 w-3" />
                      <span className="sr-only">メニュー</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleRename(convId)}
                      data-testid={`menu-rename-${convId}`}
                    >
                      <PencilIcon className="h-3 w-3 mr-2" />
                      {t("rename")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDuplicate(convId)}
                      data-testid={`menu-duplicate-${convId}`}
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      複製
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExport(convId)}
                      data-testid={`menu-export-${convId}`}
                    >
                      <Download className="h-3 w-3 mr-2" />
                      エクスポート
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleArchive(convId)}
                      data-testid={`menu-archive-${convId}`}
                    >
                      <Archive className="h-3 w-3 mr-2" />
                      {t("archive")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(convId)}
                      data-testid={`menu-delete-${convId}`}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
          
          {filteredConversations.length === 0 && conversations.length === 0 && (
            <div className="text-center p-8 text-muted-foreground text-sm">
              {t("noConversations")}
            </div>
          )}
          
          {filteredConversations.length === 0 && conversations.length > 0 && (
            <div className="text-center p-8 text-muted-foreground text-sm">
              {t("noResults")} "{searchQuery}"
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
