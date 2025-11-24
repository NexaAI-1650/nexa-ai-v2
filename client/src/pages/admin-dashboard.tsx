import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, MessageSquare, Users, ArrowLeft, Power, RotateCcw, PowerOff } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: botStatus } = useQuery({
    queryKey: ["/api/admin/bot-status"],
    refetchInterval: 2000,
  });

  const { data: botStats } = useQuery({
    queryKey: ["/api/admin/bot-stats"],
    refetchInterval: 30000,
  });

  const { data: botModels } = useQuery({
    queryKey: ["/api/admin/bot-models"],
    refetchInterval: 300000,
  });

  const { data: memoryShare } = useQuery({
    queryKey: ["/api/admin/memory-share"],
    refetchInterval: 5000,
  });

  const { data: currentBotModel } = useQuery({
    queryKey: ["/api/admin/bot-current-model"],
    refetchInterval: 30000,
  });

  const { data: rateLimit } = useQuery({
    queryKey: ["/api/admin/rate-limit"],
    refetchInterval: 5000,
  });

  const memoryShareMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/admin/memory-share", { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memory-share"] });
      toast({ description: "設定を更新しました", duration: 3000 });
    },
    onError: (error: any) => {
      toast({ 
        description: error?.message || "設定変更に失敗しました",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const rateLimitMutation = useMutation({
    mutationFn: async (limit: number) => {
      const res = await apiRequest("POST", "/api/admin/rate-limit", { limit });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rate-limit"] });
      toast({ description: "レート制限を更新しました", duration: 3000 });
    },
    onError: (error: any) => {
      toast({ 
        description: error?.message || "レート制限変更に失敗しました",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const restartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/bot-restart");
      return res.json();
    },
    onSuccess: () => {
      toast({ description: "Botを再起動しています...", duration: 3000 });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-status"] });
      }, 100);
    },
    onError: (error: any) => {
      toast({ 
        description: error?.message || "再起動に失敗しました",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const shutdownMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/bot-shutdown");
      return res.json();
    },
    onSuccess: () => {
      toast({ description: "Botをシャットダウンしています...", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-status"] });
    },
    onError: (error: any) => {
      toast({
        description: error?.message || "シャットダウンに失敗しました",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/bot-start");
      return res.json();
    },
    onSuccess: () => {
      toast({ description: "Botを起動しています...", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-status"] });
    },
    onError: (error: any) => {
      toast({
        description: error?.message || "起動に失敗しました",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const totalChats = conversations.length;
  const totalMessages = conversations.reduce(
    (sum, c) => sum + (c.messages?.length || 0),
    0
  );
  const totalTokens = conversations.reduce(
    (sum, c) =>
      sum +
      (c.messages?.reduce(
        (msgSum, m) => msgSum + Math.ceil((m.content?.length || 0) / 4),
        0
      ) || 0),
    0
  );

  const models = [
    ...new Set(conversations.map((c) => c.model || "unknown")),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-card/30 to-background">
      {/* Header */}
      <header className="border-b bg-card backdrop-blur-sm bg-card/80 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold">Bot管理ダッシュボード</h1>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              チャットに戻る
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-6xl mx-auto">
        {/* Web Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Web チャット統計</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">総チャット数</p>
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{totalChats}</p>
            </Card>

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">総メッセージ数</p>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{totalMessages}</p>
            </Card>

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">推定トークン数</p>
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">
                {Math.floor(totalTokens / 1000)}K
              </p>
            </Card>

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">利用モデル数</p>
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{models.length}</p>
            </Card>
          </div>
        </div>

        {/* Bot Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Bot 統計 (30秒ごと更新)</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">総チャット数</p>
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{botStats?.totalChats || 0}</p>
            </Card>

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">総メッセージ数</p>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{botStats?.totalMessages || 0}</p>
            </Card>

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">推定トークン数</p>
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">
                {Math.floor((botStats?.totalTokens || 0) / 1000)}K
              </p>
            </Card>

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">利用モデル数</p>
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{botStats?.modelCount || 0}</p>
            </Card>
          </div>
        </div>

        {/* Models Section - Web */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">利用中のAIモデル (Web)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.map((model) => {
              const count = conversations.filter((c) => c.model === model)
                .length;
              return (
                <div
                  key={model}
                  className="p-4 bg-muted/30 rounded-lg border border-border"
                >
                  <p className="font-mono text-sm text-foreground break-all">
                    {model}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    使用チャット: {count}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Models Section - Bot (5分ごと更新) */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">利用中のAIモデル (Bot) (5分ごと更新)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {botModels && Object.entries(botModels).map(([model, count]) => (
              <div
                key={model}
                className="p-4 bg-muted/30 rounded-lg border border-border"
              >
                <p className="font-mono text-sm text-foreground break-all">
                  {model}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  使用: {count as number}
                </p>
              </div>
            ))}
            {(!botModels || Object.keys(botModels).length === 0) && (
              <p className="text-xs text-muted-foreground col-span-2">
                データなし
              </p>
            )}
          </div>
        </Card>

        {/* Bot Control */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Bot コントロール</h2>
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">現在のモデル</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {currentBotModel?.model || "loading..."}
              </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">レート制限 (1分間のメッセージ数)</span>
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-semibold">{rateLimit?.limit || 20}</span>
                    <span className="text-xs text-muted-foreground">/60秒</span>
                  </div>
                  <Progress 
                    value={((rateLimit?.limit || 20) / 100) * 100} 
                    data-testid="progress-rate-limit"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rateLimitMutation.mutate(20)}
                  disabled={rateLimitMutation.isPending || rateLimit?.limit === 20}
                  data-testid="button-rate-limit-reset"
                >
                  リセット
                </Button>
              </div>
              <div className="mt-3 flex gap-2">
                {[20, 50, 100].map((val) => (
                  <Button
                    key={val}
                    size="sm"
                    variant={rateLimit?.limit === val ? "default" : "ghost"}
                    onClick={() => rateLimitMutation.mutate(val)}
                    disabled={rateLimitMutation.isPending}
                    className="text-xs"
                    data-testid={`button-rate-limit-${val}`}
                  >
                    {val}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">全モデル記憶共有</span>
                <Switch 
                  checked={memoryShare?.enabled || false}
                  onCheckedChange={(checked) => memoryShareMutation.mutate(checked)}
                  disabled={memoryShareMutation.isPending}
                  data-testid="toggle-memory-share"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {memoryShare?.enabled ? "有効：過去の会話を含めて AI が応答します" : "無効：現在のメッセージのみで応答します"}
              </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Bot ステータス</span>
                <span className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded ${
                  botStatus?.isRunning 
                    ? "bg-green-500/20 text-green-700 dark:text-green-400" 
                    : "bg-red-500/20 text-red-700 dark:text-red-400"
                }`}>
                  <span className={`h-2 w-2 rounded-full ${botStatus?.isRunning ? "bg-green-500" : "bg-red-500"}`} />
                  {botStatus?.isRunning ? "実行中" : "停止中"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                コマンド実行数: {botStatus?.commandCount || 0}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending || botStatus?.isRunning}
                  data-testid="button-bot-start"
                >
                  <PowerOff className="h-4 w-4 mr-2" />
                  起動
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restartMutation.mutate()}
                  disabled={restartMutation.isPending || !botStatus?.isRunning}
                  data-testid="button-bot-restart"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  再起動
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => shutdownMutation.mutate()}
                  disabled={shutdownMutation.isPending || !botStatus?.isRunning}
                  data-testid="button-bot-shutdown"
                >
                  <Power className="h-4 w-4 mr-2" />
                  シャットダウン
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
