import { X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { localStorageManager, type AppSettings } from "@/lib/localStorage";
import { aiModels } from "@shared/schema";
import { useState, useEffect } from "react";

interface AppSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const LINE_HEIGHT_OPTIONS = {
  compact: "コンパクト (1.2)",
  normal: "標準 (1.5)",
  loose: "広め (1.8)",
};

const LINE_HEIGHT_VALUES = {
  compact: 1.2,
  normal: 1.5,
  loose: 1.8,
};

export function AppSettings({ isOpen, onClose }: AppSettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(
    localStorageManager.getAppSettings()
  );

  useEffect(() => {
    setSettings(localStorageManager.getAppSettings());
  }, [isOpen]);

  const handleSave = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorageManager.saveAppSettings(newSettings);
  };

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
          {/* Font Size */}
          <div className="space-y-3">
            <Label htmlFor="font-size">
              フォントサイズ: {settings.fontSize}px
            </Label>
            <Slider
              id="font-size"
              min={12}
              max={20}
              step={1}
              value={[settings.fontSize]}
              onValueChange={(value) =>
                handleSave({ ...settings, fontSize: value[0] })
              }
              className="w-full"
              data-testid="slider-font-size"
            />
            <p className="text-xs text-muted-foreground">
              12px～20pxで調整できます
            </p>
          </div>

          {/* Line Height */}
          <div className="space-y-3">
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

          {/* Persistence Toggle */}
          <div className="flex items-center justify-between">
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
          <p className="text-xs text-muted-foreground">
            {settings.persistenceEnabled
              ? "会話が保存されます"
              : "会話は保存されません"}
          </p>

          {/* Default AI Model */}
          <div className="space-y-3">
            <Label htmlFor="default-model">デフォルトAIモデル</Label>
            <Select
              value={settings.defaultModel}
              onValueChange={(value) =>
                handleSave({ ...settings, defaultModel: value })
              }
            >
              <SelectTrigger id="default-model" data-testid="select-default-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aiModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tag System Info */}
          <div className="space-y-2 bg-muted/50 p-3 rounded-md">
            <p className="text-sm font-medium">会話ごとのタグ付け</p>
            <p className="text-xs text-muted-foreground">
              各会話の詳細ページから直接タグを付与・編集できます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
