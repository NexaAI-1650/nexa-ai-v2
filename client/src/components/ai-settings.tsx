import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { AISettings } from "@shared/schema";

interface AISettingsPanelProps {
  settings?: AISettings;
  onSave: (settings: AISettings) => void;
  onClose: () => void;
}

export function AISettingsPanel({ settings, onSave, onClose }: AISettingsPanelProps) {
  const [customInstructions, setCustomInstructions] = useState(settings?.customInstructions || "");
  const [nickname, setNickname] = useState(settings?.nickname || "");
  const [role, setRole] = useState(settings?.role || "");
  const [memoryEnabled, setMemoryEnabled] = useState(settings?.memoryEnabled || false);
  const [memory, setMemory] = useState((settings?.memory || []).join("\n"));

  const handleSave = () => {
    onSave({
      customInstructions: customInstructions || undefined,
      nickname: nickname || undefined,
      role: role || undefined,
      memoryEnabled,
      memory: memory.split("\n").filter((m) => m.trim()),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-background border rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="panel-ai-settings"
      >
        <h2 className="text-xl font-bold mb-4" data-testid="text-settings-title">
          AI設定
        </h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="nickname" className="text-sm font-medium">
              AIのニックネーム
            </Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例: 賢いアシスタント"
              data-testid="input-ai-nickname"
            />
          </div>

          <div>
            <Label htmlFor="role" className="text-sm font-medium">
              職業・役割
            </Label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="例: プログラミング講師"
              data-testid="input-ai-role"
            />
          </div>

          <div>
            <Label htmlFor="instructions" className="text-sm font-medium">
              カスタム指示
            </Label>
            <Textarea
              id="instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="AIの動作方法に関する指示を入力してください"
              className="min-h-[80px]"
              data-testid="textarea-custom-instructions"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch
                id="memory"
                checked={memoryEnabled}
                onCheckedChange={setMemoryEnabled}
                data-testid="switch-memory-enabled"
              />
              <Label htmlFor="memory" className="text-sm font-medium">
                メモリ機能を有効にする
              </Label>
            </div>
            {memoryEnabled && (
              <Textarea
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
                placeholder="AIに覚えさせたいことを入力してください（1行につき1つ）"
                className="min-h-[60px]"
                data-testid="textarea-memory-content"
              />
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-6 justify-end">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            キャンセル
          </Button>
          <Button onClick={handleSave} data-testid="button-save-settings">
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
