import { X, Settings, Moon, Sun, RotateCcw, Archive, Trash2, ChevronDown, Bell, Palette, Sliders } from "lucide-react";
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

type SectionType = "general" | "ai" | "data";

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

  const archivedCount = conversations.filter(c => c.archived).length;

  useEffect(() => {
    setSettings(localStorageManager.getAppSettings());
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

                {/* Font Size */}
                <div className="py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="font-size" className="text-sm">{t("fontSize")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={10}
                        max={40}
                        value={settings.fontSize}
                        onChange={(e) => {
                          const val = Math.min(40, Math.max(10, parseInt(e.target.value) || 10));
                          handleSave({ ...settings, fontSize: val });
                        }}
                        className="w-12 h-8 text-center text-xs"
                        data-testid="input-font-size"
                      />
                      <span className="text-xs text-muted-foreground">{t("px")}</span>
                    </div>
                  </div>
                  <Slider
                    id="font-size"
                    min={10}
                    max={40}
                    step={1}
                    value={[settings.fontSize]}
                    onValueChange={(value) =>
                      handleSave({ ...settings, fontSize: value[0] })
                    }
                    className="w-full"
                    data-testid="slider-font-size"
                  />
                </div>

                {/* Line Height */}
                <div className="flex items-center justify-between py-3 px-3 hover:bg-muted/30 rounded-md transition-colors">
                  <Label htmlFor="line-height" className="text-sm">{t("messageLineHeight")}</Label>
                  <Select
                    value={settings.lineHeight}
                    onValueChange={(value) =>
                      handleSave({
                        ...settings,
                        lineHeight: value as "compact" | "normal" | "loose",
                      })
                    }
                  >
                    <SelectTrigger id="line-height" data-testid="select-line-height" className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">{t("compact")}</SelectItem>
                      <SelectItem value="normal">{t("normal")}</SelectItem>
                      <SelectItem value="loose">{t("loose")}</SelectItem>
                    </SelectContent>
                  </Select>
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
                      onChange={(e) => setAiNickname(e.target.value)}
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
                      onChange={(e) => setAiRole(e.target.value)}
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
                      onChange={(e) => setAiCustom(e.target.value)}
                      className="mt-2 min-h-24 resize-none"
                      data-testid="textarea-ai-custom"
                    />
                  </div>
                </div>
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
                    onClick={() => {}}
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
