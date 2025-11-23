import { X, Settings, Moon, Sun, RotateCcw, Archive, Trash2, ChevronDown, Bell, Palette, Sliders, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { localStorageManager, type AppSettings } from "@/lib/localStorage";
import { useLanguage } from "@/lib/useLanguage";
import { aiModels } from "@shared/schema";
import { useState, useEffect } from "react";
import { useTheme } from "./theme-provider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Conversation } from "@shared/schema";

interface AppSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const LINE_HEIGHT_OPTIONS = {
  compact: "コンパクト (1.2)",
  normal: "標準 (1.5)",
  loose: "広め (1.8)",
};

type SectionType = "general" | "ai" | "data" | "stats" | "archived";

export function AppSettings({ isOpen, onClose }: AppSettingsProps) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<AppSettings>(
    localStorageManager.getAppSettings()
  );
  const [activeSection, setActiveSection] = useState<SectionType>("general");
  const [aiNickname, setAiNickname] = useState("");
  const [aiRole, setAiRole] = useState("");
  const [aiCustom, setAiCustom] = useState("");
  const [language, setLanguage] = useState(() => localStorageManager.getLanguage());
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });
  
  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/conversations/${id}`, { archived: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ description: "チャットを復元しました" });
    },
  });

  const archivedConversations = (conversations && Array.isArray(conversations)) ? conversations.filter(c => c.archived === true) : [];
  const archivedCount = archivedConversations.length;
  const totalConversations = (conversations && Array.isArray(conversations)) ? conversations.length : 0;
  const totalTokens = (conversations && Array.isArray(conversations)) ? conversations.reduce((sum, c) => sum + (c.messages ? c.messages.reduce((msgSum, m) => msgSum + Math.ceil((m.content?.length || 0) / 4), 0) : 0), 0) : 0;
  const totalMessages = (conversations && Array.isArray(conversations)) ? conversations.reduce((sum, c) => sum + (c.messages ? c.messages.length : 0), 0) : 0;

  useEffect(() => {
    setSettings(localStorageManager.getAppSettings());
    if (isOpen) {
      const aiConfig = localStorageManager.getAiConfig();
      setAiNickname(aiConfig.nickname);
      setAiRole(aiConfig.role);
      setAiCustom(aiConfig.custom);
    }
  }, [isOpen]);

  const handleSave = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorageManager.saveAppSettings(newSettings);
  };

  const archiveAllMutation = useMutation({
    mutationFn: async () => {
      const notArchived = conversations.filter(c => !c.archived);
      for (const conv of notArchived) {
        await apiRequest("PATCH", `/api/conversations/${conv.id}`, { archived: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ description: "すべての会話をアーカイブしました" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const notArchived = conversations.filter(c => !c.archived);
      for (const conv of notArchived) {
        await apiRequest("DELETE", `/api/conversations/${conv.id}`, {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ description: "すべての会話を削除しました" });
    },
  });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm" 
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-screen animate-slide-in-bottom shadow-lg flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="panel-app-settings"
      >
        {/* Left Sidebar Menu */}
        <div className="w-48 bg-sidebar border-r border-sidebar-border flex flex-col">
          <div className="p-4 border-b border-sidebar-border">
            <h2 className="font-semibold text-base text-sidebar-foreground flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t("appSettings")}
            </h2>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              onClick={() => setActiveSection("general")}
              className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors flex items-center gap-3 font-medium ${
                activeSection === "general"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
              data-testid="section-general"
            >
              <Settings className="h-4 w-4 shrink-0" />
              {t("general")}
            </button>
            <button
              onClick={() => setActiveSection("ai")}
              className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors flex items-center gap-3 font-medium ${
                activeSection === "ai"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
              data-testid="section-ai"
            >
              <Palette className="h-4 w-4 shrink-0" />
              {t("aiSettings")}
            </button>
            <button
              onClick={() => setActiveSection("stats")}
              className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors flex items-center gap-3 font-medium ${
                activeSection === "stats"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
              data-testid="section-stats"
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              {t("statistics") || "使用統計"}
            </button>
            <button
              onClick={() => setActiveSection("data")}
              className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors flex items-center gap-3 font-medium ${
                activeSection === "data"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
              data-testid="section-data"
            >
              <Sliders className="h-4 w-4 shrink-0" />
              {t("dataControl")}
            </button>
          </nav>
          <div className="p-2 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground"
              onClick={onClose}
              data-testid="button-close-settings"
            >
              <X className="h-4 w-4 mr-2" />
              {t("close")}
            </Button>
          </div>
        </div>

        {/* Right Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* 一般 */}
            {activeSection === "general" && (
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-foreground">{t("generalSettings")}</h3>

                {/* Theme */}
                <div className="flex items-center justify-between py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                  <Label className="text-sm">{t("theme")}</Label>
                  <div className="flex gap-1">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("light")}
                      data-testid="button-theme-light"
                      className="h-8"
                    >
                      <Sun className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                      data-testid="button-theme-dark"
                      className="h-8"
                    >
                      <Moon className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Language */}
                <div className="flex items-center justify-between py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                  <Label htmlFor="language" className="text-sm">{t("language")}</Label>
                  <Select
                    value={language}
                    onValueChange={(value) => {
                      localStorageManager.saveLanguage(value);
                      setLanguage(value);
                      window.location.reload();
                    }}
                  >
                    <SelectTrigger id="language" data-testid="select-language" className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ja">{t("japanese")}</SelectItem>
                      <SelectItem value="en">{t("english")}</SelectItem>
                      <SelectItem value="zh">{t("chinese")}</SelectItem>
                      <SelectItem value="hi">{t("hindi")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* AI設定 */}
            {activeSection === "ai" && (
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-foreground">{t("aiSettings")}</h3>

                <div className="space-y-4">
                  <div className="py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                    <Label htmlFor="ai-nickname" className="text-sm">{t("aiNickname")}</Label>
                    <Input
                      id="ai-nickname"
                      placeholder={`${t("example")}${t("assistant")}`}
                      value={aiNickname}
                      onChange={(e) => {
                        setAiNickname(e.target.value);
                        localStorageManager.saveAiConfig({ nickname: e.target.value, role: aiRole, custom: aiCustom });
                      }}
                      className="mt-2 h-8"
                      data-testid="input-ai-nickname"
                    />
                  </div>

                  <div className="py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                    <Label htmlFor="ai-role" className="text-sm">{t("role")}</Label>
                    <Input
                      id="ai-role"
                      placeholder={`${t("example")}${t("programmer")}`}
                      value={aiRole}
                      onChange={(e) => {
                        setAiRole(e.target.value);
                        localStorageManager.saveAiConfig({ nickname: aiNickname, role: e.target.value, custom: aiCustom });
                      }}
                      className="mt-2 h-8"
                      data-testid="input-ai-role"
                    />
                  </div>

                  <div className="py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                    <Label htmlFor="ai-custom" className="text-sm">{t("customInstructions")}</Label>
                    <Textarea
                      id="ai-custom"
                      placeholder={t("specialInstructions")}
                      value={aiCustom}
                      onChange={(e) => {
                        setAiCustom(e.target.value);
                        localStorageManager.saveAiConfig({ nickname: aiNickname, role: aiRole, custom: e.target.value });
                      }}
                      className="mt-2 min-h-24 resize-none"
                      data-testid="textarea-ai-custom"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 統計 */}
            {activeSection === "stats" && (
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-foreground">{t("statistics") || "使用統計"}</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <p className="text-xs text-muted-foreground">{t("totalChats") || "総チャット数"}</p>
                    <p className="text-2xl font-bold text-foreground">{totalConversations}</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <p className="text-xs text-muted-foreground">{t("totalMessages") || "総メッセージ数"}</p>
                    <p className="text-2xl font-bold text-foreground">{totalMessages}</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <p className="text-xs text-muted-foreground">{t("estimatedTokens") || "推定トークン数"}</p>
                    <p className="text-2xl font-bold text-foreground">{totalTokens.toLocaleString()}</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <p className="text-xs text-muted-foreground">{t("archived") || "アーカイブ済み"}</p>
                    <p className="text-2xl font-bold text-foreground">{archivedCount}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>• {t("tokenEstimate") || "トークン数は文字数を4で割った推定値です"}</p>
                  <p>• {t("statsBasedOnLocal") || "統計情報はローカルストレージのデータに基づいています"}</p>
                  <p>• {t("archivedIncluded") || "アーカイブされたチャットも統計に含まれます"}</p>
                </div>
              </div>
            )}

            {/* アーカイブ済みチャット管理 */}
            {activeSection === "archived" && (
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-foreground">{t("archivedChats") || "アーカイブ済みチャット"} ({archivedCount})</h3>

                {archivedConversations.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground text-sm">
                    アーカイブ済みのチャットはありません
                  </div>
                ) : (
                  <div className="space-y-2">
                    {archivedConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">{conv.title}</p>
                          <p className="text-xs text-muted-foreground">{conv.messages?.length || 0} メッセージ</p>
                        </div>
                        <div className="flex gap-2 ml-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => unarchiveMutation.mutate(conv.id)}
                            disabled={unarchiveMutation.isPending}
                          >
                            復元
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              if (confirm(`このチャット「${conv.title}」を削除しますか？この操作は取り消せません。`)) {
                                fetch(`/api/conversations/${conv.id}`, { method: "DELETE" }).then(() => {
                                  queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                                  toast({ description: "チャットを削除しました" });
                                }).catch((err) => {
                                  console.error("Delete error:", err);
                                  toast({
                                    title: "エラー",
                                    description: "チャットの削除に失敗しました",
                                    variant: "destructive",
                                  });
                                });
                              }
                            }}
                          >
                            削除
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* データコントロール */}
            {activeSection === "data" && (
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-foreground">{t("dataControl")}</h3>

                {/* Archived Chats */}
                <div className="flex items-center justify-between py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">{t("archivedChats")}</p>
                      <p className="text-xs text-muted-foreground">{archivedCount}{t("items")}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveSection("archived")}
                    className="h-8"
                    data-testid="button-manage-archived"
                  >
                    {t("manage")}
                  </Button>
                </div>

                <Separator />

                {/* Archive All */}
                <div className="flex items-center justify-between py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                  <Label className="text-sm">
                    {t("archiveAllChats")}
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      if (confirm(`${t("archiveAllChats")}${language === "ja" ? "？" : "?"}`)) {
                        archiveAllMutation.mutate();
                      }
                    }}
                    data-testid="button-archive-all"
                  >
                    {t("archiveAll")}
                  </Button>
                </div>

                {/* Delete All */}
                <div className="flex items-center justify-between py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                  <Label className="text-sm text-destructive">
                    {t("deleteAllChats")}
                  </Label>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      if (confirm(`${t("deleteAllChats")}${language === "ja" ? "？この操作は取り消せません。" : "? This action cannot be undone."}`)) {
                        deleteAllMutation.mutate();
                      }
                    }}
                    data-testid="button-delete-all"
                  >
                    {t("deleteAll")}
                  </Button>
                </div>

                <Separator />

                {/* Persistence */}
                <div className="flex items-center justify-between py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                  <Label className="text-sm">{t("persistenceToggle")}</Label>
                  <Switch
                    checked={settings.persistenceEnabled}
                    onCheckedChange={(checked) =>
                      handleSave({ ...settings, persistenceEnabled: checked })
                    }
                    data-testid="toggle-persistence"
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
