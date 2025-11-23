import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, MessageSquare, Users, ArrowLeft, Power, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";

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

  const restartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/bot-restart");
      return res.json();
    },
    onSuccess: () => {
      toast({ description: "Botを再起動しています..." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-status"] });
    },
    onError: (error: any) => {
      toast({ 
        description: error?.message || "再起動に失敗しました",
        variant: "destructive",
      });
    },
  });

  const shutdownMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/bot-shutdown");
      return res.json();
    },
    onSuccess: () => {
      toast({ description: "Botをシャットダウンしています..." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-status"] });
    },
    onError: (error: any) => {
      toast({
        description: error?.message || "シャットダウンに失敗しました",
        variant: "destructive",
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
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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

        {/* Models Section */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">利用中のAIモデル</h2>
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

        {/* Bot Control */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Bot コントロール</h2>
          <div className="space-y-4">
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
                  onClick={() => restartMutation.mutate()}
                  disabled={restartMutation.isPending}
                  data-testid="button-bot-restart"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  再起動
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => shutdownMutation.mutate()}
                  disabled={shutdownMutation.isPending}
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
