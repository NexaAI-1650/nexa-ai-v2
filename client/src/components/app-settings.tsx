import { X, Settings, Moon, Sun, RotateCcw, Archive, Trash2 } from "lucide-react";
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
import { localStorageManager, type AppSettings } from "@/lib/localStorage";
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

export function AppSettings({ isOpen, onClose }: AppSettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(
    localStorageManager.getAppSettings()
  );
  const [aiNickname, setAiNickname] = useState("");
  const [aiRole, setAiRole] = useState("");
  const [aiCustom, setAiCustom] = useState("");
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
        className="bg-background border rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto animate-slide-in-bottom shadow-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="panel-app-settings"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h2 className="text-xl font-bold">アプリ設定</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* 一般 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">一般</h3>

            {/* Theme */}
            <div className="space-y-2">
              <Label>テーマ</Label>
              <div className="flex gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme("light")}
                  data-testid="button-theme-light"
                >
                  <Sun className="h-3 w-3 mr-1" />
                  ライト
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme("dark")}
                  data-testid="button-theme-dark"
                >
                  <Moon className="h-3 w-3 mr-1" />
                  ダーク
                </Button>
              </div>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="font-size">フォントサイズ</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSave({ ...settings, fontSize: 16 })}
                  data-testid="button-font-size-reset"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  リセット
                </Button>
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
                  className="w-16 text-center"
                  data-testid="input-font-size"
                />
                <span className="text-xs text-muted-foreground">px</span>
              </div>
            </div>

            {/* Line Height */}
            <div className="space-y-2">
              <Label htmlFor="line-height">メッセージの行間</Label>
              <Select
                value={settings.lineHeight}
                onValueChange={(value) =>
                  handleSave({
                    ...settings,
                    lineHeight: value as "compact" | "normal" | "loose",
                  })
                }
              >
                <SelectTrigger id="line-height" data-testid="select-line-height">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">
                    {LINE_HEIGHT_OPTIONS.compact}
                  </SelectItem>
                  <SelectItem value="normal">
                    {LINE_HEIGHT_OPTIONS.normal}
                  </SelectItem>
                  <SelectItem value="loose">
                    {LINE_HEIGHT_OPTIONS.loose}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* AI設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">AI設定</h3>

            <div className="space-y-2">
              <Label htmlFor="ai-nickname">AIのニックネーム</Label>
              <Input
                id="ai-nickname"
                placeholder="例：アシスタント"
                value={aiNickname}
                onChange={(e) => setAiNickname(e.target.value)}
                data-testid="input-ai-nickname"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-role">職業・役割</Label>
              <Input
                id="ai-role"
                placeholder="例：プログラミングの専門家"
                value={aiRole}
                onChange={(e) => setAiRole(e.target.value)}
                data-testid="input-ai-role"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-custom">カスタム指示</Label>
              <Textarea
                id="ai-custom"
                placeholder="AIに特別な指示を与えます"
                value={aiCustom}
                onChange={(e) => setAiCustom(e.target.value)}
                className="resize-none h-20"
                data-testid="textarea-ai-custom"
              />
            </div>
          </div>

          <Separator />

          {/* データコントロール */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">データコントロール</h3>

            {/* Archived Chats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">アーカイブ済みのチャット</p>
                  <p className="text-xs text-muted-foreground">{archivedCount}件</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {}}
                data-testid="button-manage-archived"
              >
                管理する
              </Button>
            </div>

            {/* Archive All */}
            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="archive-all" className="text-sm">
                すべてのチャットをアーカイブする
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm("すべての会話をアーカイブしますか？")) {
                    archiveAllMutation.mutate();
                  }
                }}
                data-testid="button-archive-all"
              >
                すべてアーカイブする
              </Button>
            </div>

            {/* Delete All */}
            <div className="flex items-center justify-between">
              <Label htmlFor="delete-all" className="text-sm text-destructive">
                すべてのチャットを削除する
              </Label>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("すべての会話を削除しますか？この操作は取り消せません。")) {
                    deleteAllMutation.mutate();
                  }
                }}
                data-testid="button-delete-all"
              >
                すべて削除する
              </Button>
            </div>

            {/* Persistence */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Label htmlFor="persistence-toggle">会話履歴の永続化</Label>
              <Switch
                id="persistence-toggle"
                checked={settings.persistenceEnabled}
                onCheckedChange={(checked) =>
                  handleSave({ ...settings, persistenceEnabled: checked })
                }
                data-testid="toggle-persistence"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
