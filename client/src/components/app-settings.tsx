import { X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppSettings({ isOpen, onClose }: AppSettingsProps) {
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
        <div className="flex items-center justify-between mb-4">
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

        <div className="space-y-4 text-muted-foreground text-sm">
          <p>設定オプションはこちらに表示されます。</p>
        </div>
      </div>
    </div>
  );
}
