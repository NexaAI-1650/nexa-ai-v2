import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, MessageSquare, Users, ArrowLeft, Power, RotateCcw, PowerOff, LogIn, LogOut, Globe } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const i18n = {
  ja: {
    title: "Bot管理ダッシュボード",
    logout: "ログアウト",
    selectServer: "サーバーを選択",
    selectPlaceholder: "サーバーを選択してください",
    noServers: "Bot が入っているサーバーがありません",
    botStats: "Bot 統計 (30秒ごと更新)",
    totalChats: "総チャット数",
    totalMessages: "総メッセージ数",
    totalTokens: "推定トークン数",
    modelCount: "利用モデル数",
    models: "利用中のAIモデル (Bot) (5分ごと更新)",
    usage: "使用",
    noData: "データなし",
    botControl: "Bot コントロール",
    currentModel: "現在のモデル",
    rateLimit: "レート制限 (1分間のメッセージ数)",
    perMin: "/60秒",
    memoryShare: "記憶共有",
    memoryDesc: "会話履歴を共有する",
    enabled: "有効",
    disabled: "無効",
    preset10: "プリセット: 10",
    preset20: "プリセット: 20",
    preset50: "プリセット: 50",
    botRunning: "Bot 実行中",
    botStopped: "Bot 停止中",
    uptime: "稼働時間",
    commandCount: "実行したコマンド数",
    help: "ヘルプ",
    testLogin: "開発用テストログイン",
    testLoginDesc: "（開発テスト用）",
    discordLogin: "Discord でログイン",
    notAuthenticated: "認証が必要です",
    selectServerMsg: "サーバーを選択してください",
  },
  en: {
    title: "Bot Management Dashboard",
    logout: "Logout",
    selectServer: "Select Server",
    selectPlaceholder: "Select a server",
    noServers: "No servers found where Bot is present",
    botStats: "Bot Stats (Updated every 30 seconds)",
    totalChats: "Total Chats",
    totalMessages: "Total Messages",
    totalTokens: "Estimated Tokens",
    modelCount: "Models Used",
    models: "AI Models in Use (Bot) (Updated every 5 minutes)",
    usage: "Usage",
    noData: "No data",
    botControl: "Bot Control",
    currentModel: "Current Model",
    rateLimit: "Rate Limit (Messages per minute)",
    perMin: "/60 seconds",
    memoryShare: "Memory Share",
    memoryDesc: "Share conversation history",
    enabled: "Enabled",
    disabled: "Disabled",
    preset10: "Preset: 10",
    preset20: "Preset: 20",
    preset50: "Preset: 50",
    botRunning: "Bot Running",
    botStopped: "Bot Stopped",
    uptime: "Uptime",
    commandCount: "Commands Executed",
    help: "Help",
    testLogin: "Test Login (Dev)",
    testLoginDesc: "(For development testing)",
    discordLogin: "Login with Discord",
    notAuthenticated: "Authentication required",
    selectServerMsg: "Please select a server",
  },
  zh: {
    title: "机器人管理仪表板",
    logout: "登出",
    selectServer: "选择服务器",
    selectPlaceholder: "请选择服务器",
    noServers: "未找到机器人所在的服务器",
    botStats: "机器人统计 (每30秒更新)",
    totalChats: "总聊天数",
    totalMessages: "总消息数",
    totalTokens: "估计代币数",
    modelCount: "已用模型数",
    models: "正在使用的人工智能模型 (机器人) (每5分钟更新)",
    usage: "使用",
    noData: "无数据",
    botControl: "机器人控制",
    currentModel: "当前模型",
    rateLimit: "速率限制 (每分钟消息数)",
    perMin: "/60秒",
    memoryShare: "记忆共享",
    memoryDesc: "共享对话历史",
    enabled: "启用",
    disabled: "禁用",
    preset10: "预设: 10",
    preset20: "预设: 20",
    preset50: "预设: 50",
    botRunning: "机器人运行中",
    botStopped: "机器人已停止",
    uptime: "正常运行时间",
    commandCount: "执行的命令数",
    help: "帮助",
    testLogin: "测试登录 (开发)",
    testLoginDesc: "(用于开发测试)",
    discordLogin: "使用 Discord 登录",
    notAuthenticated: "需要身份验证",
    selectServerMsg: "请选择服务器",
  },
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sliderValue, setSliderValue] = useState<number[]>([20]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [language, setLanguage] = useState<"ja" | "en" | "zh">("ja");
  const sliderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const t = i18n[language];

  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: 1,
  }) as any;

  const { data: guilds = [] } = useQuery({
    queryKey: ["/api/admin/my-guilds"],
    refetchInterval: 30000,
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch("/api/admin/my-guilds");
      if (res.status === 401) return { guilds: [] };
      return res.json().then(d => ({ guilds: d.guilds || [] }));
    },
  }) as any;
  
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: botStatus = {} as any } = useQuery({
    queryKey: ["/api/admin/bot-status"],
    refetchInterval: 2000,
  });

  const { data: botStats = {} as any } = useQuery({
    queryKey: ["/api/admin/bot-stats"],
    refetchInterval: 30000,
  });

  const { data: botModels = {} as any } = useQuery({
    queryKey: ["/api/admin/bot-models"],
    refetchInterval: 300000,
  });

  const { data: memoryShare = {} as any } = useQuery({
    queryKey: ["/api/admin/memory-share", selectedGuildId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/memory-share?guildId=${selectedGuildId}`);
      return res.json();
    },
    refetchInterval: 5000,
    enabled: selectedGuildId !== null,
  });

  const { data: currentBotModel = {} as any } = useQuery({
    queryKey: ["/api/admin/bot-current-model", selectedGuildId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/bot-current-model?guildId=${selectedGuildId}`);
      return res.json();
    },
    refetchInterval: 30000,
    enabled: selectedGuildId !== null,
  });

  const { data: rateLimit } = useQuery({
    queryKey: ["/api/admin/rate-limit", selectedGuildId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/rate-limit?guildId=${selectedGuildId}`);
      return res.json();
    },
    refetchInterval: 5000,
    enabled: selectedGuildId !== null,
  });

  useEffect(() => {
    if (rateLimit?.limit) {
      setSliderValue([rateLimit.limit]);
    }
  }, [rateLimit?.limit]);

  const memoryShareMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/admin/memory-share", { enabled, guildId: selectedGuildId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memory-share", selectedGuildId] });
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
      const res = await apiRequest("POST", "/api/admin/rate-limit", { limit, guildId: selectedGuildId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rate-limit", selectedGuildId] });
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

  const { data: authUrl } = useQuery({
    queryKey: ["/api/auth/discord"],
    enabled: !user,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{t.title}</h1>
            <Select value={language} onValueChange={(value) => setLanguage(value as "ja" | "en" | "zh")}>
              <SelectTrigger className="w-auto" data-testid="select-language-login">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-muted-foreground mb-6">
            {language === "ja" ? "Discord アカウントで連携してダッシュボードにアクセスしてください。" : "Access the dashboard by linking your Discord account."}
          </p>
          <Button 
            className="w-full mb-3" 
            onClick={() => {
              if (authUrl?.authUrl) {
                window.location.href = authUrl.authUrl;
              }
            }}
            disabled={!authUrl?.authUrl}
            data-testid="button-discord-login"
          >
            <LogIn className="w-4 h-4 mr-2" />
            {t.discordLogin}
          </Button>
          <div className="border-t my-4 pt-4">
            <p className="text-xs text-muted-foreground text-center mb-3">
              {t.testLoginDesc}
            </p>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={async () => {
                try {
                  await fetch("/api/auth/test-login");
                  window.location.reload();
                } catch (error) {
                  console.error("Test login failed:", error);
                }
              }}
              data-testid="button-test-login"
            >
              {t.testLogin}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-card/30 to-background">
      {/* Header */}
      <header className="border-b bg-card backdrop-blur-sm bg-card/80 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {user?.avatar ? (
                <img 
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`}
                  alt={user.username}
                  className="w-8 h-8 rounded-full"
                  data-testid="img-user-avatar"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted" data-testid="div-user-avatar-fallback" />
              )}
              <span className="text-sm text-muted-foreground" data-testid="text-username">{user?.username}</span>
              <Select value={language} onValueChange={(value) => setLanguage(value as "ja" | "en" | "zh")}>
                <SelectTrigger className="w-auto" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                fetch("/api/auth/logout").then(() => window.location.reload());
              }}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t.logout}
            </Button>
          </div>
        </div>
      </header>

      {/* Server Selector */}
      <div className="border-b bg-card/50 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-2">
            <label className="text-sm font-medium">{t.selectServer}</label>
          </div>
          <Select value={selectedGuildId || ""} onValueChange={setSelectedGuildId}>
            <SelectTrigger data-testid="select-guild" className="w-full max-w-xs">
              <SelectValue placeholder={t.selectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {(guilds?.guilds || []).length === 0 ? (
                <SelectItem value="_none" disabled>
                  {t.noServers}
                </SelectItem>
              ) : (
                (guilds?.guilds || []).map((guild: any) => (
                  <SelectItem key={guild.guildId} value={guild.guildId}>
                    <div className="flex items-center gap-2">
                      {guild.icon ? (
                        <img 
                          src={`https://cdn.discordapp.com/icons/${guild.guildId}/${guild.icon}.png?size=32`}
                          alt={guild.guildName}
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted" />
                      )}
                      <span>{guild.guildName || `Server: ${guild.guildId}`}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-6 max-w-6xl mx-auto">
        {!selectedGuildId ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">{t.selectServerMsg}</p>
          </Card>
        ) : (
          <>
        {/* Bot Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">{t.botStats}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t.totalChats}</p>
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{botStats?.totalChats || 0}</p>
            </Card>

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t.totalMessages}</p>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{botStats?.totalMessages || 0}</p>
            </Card>

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t.totalTokens}</p>
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">
                {Math.floor((botStats?.totalTokens || 0) / 1000)}K
              </p>
            </Card>

            <Card className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t.modelCount}</p>
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{botStats?.modelCount || 0}</p>
            </Card>
          </div>
        </div>

        {/* Models Section - Bot (5分ごと更新) */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{t.models}</h2>
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
                  {t.usage}: {count as number}
                </p>
              </div>
            ))}
            {(!botModels || Object.keys(botModels).length === 0) && (
              <p className="text-xs text-muted-foreground col-span-2">
                {t.noData}
              </p>
            )}
          </div>
        </Card>

        {/* Bot Control */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{t.botControl}</h2>
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{t.currentModel}</span>
              </div>
              <p className="text-lg font-semibold font-mono break-all">
                {currentBotModel?.model || "loading..."}
              </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{t.rateLimit}</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Slider
                      value={sliderValue}
                      onValueChange={(value) => {
                        setSliderValue(value);
                        
                        if (sliderTimeoutRef.current) {
                          clearTimeout(sliderTimeoutRef.current);
                        }
                        
                        sliderTimeoutRef.current = setTimeout(() => {
                          rateLimitMutation.mutate(value[0]);
                        }, 400);
                      }}
                      min={1}
                      max={100}
                      step={1}
                      disabled={rateLimitMutation.isPending}
                      data-testid="slider-rate-limit"
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <span className="text-lg font-semibold">{sliderValue[0]}</span>
                    <span className="text-xs text-muted-foreground">{t.perMin}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSliderValue([20]);
                      rateLimitMutation.mutate(20);
                    }}
                    disabled={rateLimitMutation.isPending || sliderValue[0] === 20}
                    data-testid="button-rate-limit-reset"
                  >
                    {language === "ja" ? "リセット" : "Reset"}
                  </Button>
                  {[10, 20, 50].map((val) => (
                    <Button
                      key={val}
                      size="sm"
                      variant={sliderValue[0] === val ? "default" : "ghost"}
                      onClick={() => {
                        setSliderValue([val]);
                        rateLimitMutation.mutate(val);
                      }}
                      disabled={rateLimitMutation.isPending}
                      className="text-xs"
                      data-testid={`button-rate-limit-${val}`}
                    >
                      {language === "ja" ? `プリセット: ${val}` : `Preset: ${val}`}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{t.memoryShare}</span>
                <Switch 
                  checked={memoryShare?.enabled || false}
                  onCheckedChange={(checked) => memoryShareMutation.mutate(checked)}
                  disabled={memoryShareMutation.isPending}
                  data-testid="toggle-memory-share"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {memoryShare?.enabled ? (language === "ja" ? "有効：過去の会話を含めて AI が応答します" : "Enabled: AI includes past conversations") : (language === "ja" ? "無効：現在のメッセージのみで応答します" : "Disabled: AI responds to current message only")}
              </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{language === "ja" ? "Bot ステータス" : "Bot Status"}</span>
                <span className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded ${
                  botStatus?.isRunning 
                    ? "bg-green-500/20 text-green-700 dark:text-green-400" 
                    : "bg-red-500/20 text-red-700 dark:text-red-400"
                }`}>
                  <span className={`h-2 w-2 rounded-full ${botStatus?.isRunning ? "bg-green-500" : "bg-red-500"}`} />
                  {botStatus?.isRunning ? (language === "ja" ? "実行中" : "Running") : (language === "ja" ? "停止中" : "Stopped")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {t.commandCount}: {botStatus?.commandCount || 0}
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
                  {language === "ja" ? "起動" : "Start"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restartMutation.mutate()}
                  disabled={restartMutation.isPending || !botStatus?.isRunning}
                  data-testid="button-bot-restart"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {language === "ja" ? "再起動" : "Restart"}
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
          </>
        )}
      </main>
    </div>
  );
}
