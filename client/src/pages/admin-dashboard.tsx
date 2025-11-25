import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, MessageSquare, Users, ArrowLeft, Power, RotateCcw, PowerOff, LogIn, LogOut, Globe, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation, BotEventLog, BotMetrics } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const i18n = {
  ja: {
    title: "Nexa AI ダッシュボード",
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
    eventLogs: "イベントログ",
    errorLogs: "エラーログ",
    warningLogs: "警告ログ",
    infoLogs: "情報ログ",
    performance: "パフォーマンス",
    responseTime: "応答時間",
    errorRate: "エラー率",
    successRate: "成功率",
    ms: "ms",
    moderation: "モデレーション設定",
    lowTimeoutMinutes: "低度のタイムアウト (分)",
    mediumAction: "中度のアクション",
    mediumTimeoutMinutes: "中度のタイムアウト (分)",
    highAction: "高度のアクション",
    keywords: "NG ワード一覧",
    timeout: "タイムアウト",
    kick: "キック",
    ban: "バン",
  },
  en: {
    title: "Nexa AI Dashboard",
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
    eventLogs: "Event Logs",
    errorLogs: "Error Logs",
    warningLogs: "Warning Logs",
    infoLogs: "Info Logs",
    performance: "Performance",
    responseTime: "Response Time",
    errorRate: "Error Rate",
    successRate: "Success Rate",
    ms: "ms",
    moderation: "Moderation Settings",
    lowTimeoutMinutes: "Low Timeout (minutes)",
    mediumAction: "Medium Action",
    mediumTimeoutMinutes: "Medium Timeout (minutes)",
    highAction: "High Action",
    keywords: "Keywords List",
    timeout: "Timeout",
    kick: "Kick",
    ban: "Ban",
  },
  zh: {
    title: "Nexa AI 仪表板",
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
    eventLogs: "事件日志",
    errorLogs: "错误日志",
    warningLogs: "警告日志",
    infoLogs: "信息日志",
    performance: "性能",
    responseTime: "响应时间",
    errorRate: "错误率",
    successRate: "成功率",
    ms: "毫秒",
    moderation: "审核设置",
    lowTimeoutMinutes: "低度超时 (分钟)",
    mediumAction: "中度操作",
    mediumTimeoutMinutes: "中度超时 (分钟)",
    highAction: "高度操作",
    keywords: "关键词列表",
    timeout: "超时",
    kick: "踢出",
    ban: "封禁",
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

  const { data: eventLogs = { logs: [] } } = useQuery({
    queryKey: ["/api/admin/event-logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/event-logs?limit=50");
      return res.json();
    },
    refetchInterval: 10000,
  }) as any;

  const { data: metricsData = { metrics: [] } } = useQuery({
    queryKey: ["/api/admin/bot-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/bot-metrics?limit=50");
      return res.json();
    },
    refetchInterval: 30000,
  }) as any;

  const { data: moderationSettings = {} as any } = useQuery({
    queryKey: ["/api/admin/moderation-settings", selectedGuildId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/moderation-settings?guildId=${selectedGuildId}`);
      return res.json();
    },
    enabled: selectedGuildId !== null,
  });

  useEffect(() => {
    if (rateLimit?.limit) {
      setSliderValue([rateLimit.limit]);
    }
  }, [rateLimit?.limit]);

  const [pendingModeration, setPendingModeration] = useState<any>(null);

  const moderationMutation = useMutation({
    mutationFn: async (settings: any) => {
      if (!selectedGuildId) {
        throw new Error("サーバーを選択してください");
      }
      const res = await fetch("/api/admin/moderation-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, guildId: selectedGuildId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "エラーが発生しました" }));
        throw new Error(errData.error || "設定更新に失敗しました");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation-settings", selectedGuildId] });
      setPendingModeration(null);
      toast({ description: "モデレーション設定を保存しました", duration: 3000 });
    },
    onError: (error: any) => {
      toast({ 
        description: error instanceof Error ? error.message : "設定保存に失敗しました",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

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

  const models = Array.from(
    new Set(conversations.map((c) => c.model || "unknown"))
  );

  const { data: authUrl } = useQuery({
    queryKey: ["/api/auth/discord"],
    enabled: !user,
  }) as any;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="p-8 shadow-2xl border border-border/50 hover-elevate">
            <div className="space-y-4 mb-8">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <h1 className="text-3xl font-bold text-primary whitespace-normal">{t.title}</h1>
                  <p className="text-xs text-muted-foreground">{language === "ja" ? "管理ツール" : language === "en" ? "Admin Tool" : "管理工具"}</p>
                </div>
                <Select value={language} onValueChange={(value) => setLanguage(value as "ja" | "en" | "zh")}>
                  <SelectTrigger className="w-auto border-primary/30 hover:border-primary/60 flex-shrink-0" data-testid="select-language-login">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ja">日本語</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              {language === "ja" ? "Discord アカウントで連携してダッシュボードにアクセスしてください。" : language === "en" ? "Access the dashboard by linking your Discord account." : "使用 Discord 帐户链接以访问仪表板。"}
            </p>
            
            <Button 
              className="w-full mb-4 h-11 text-base font-semibold shadow-lg hover-elevate" 
              onClick={() => {
                if (authUrl?.authUrl) {
                  window.location.href = authUrl.authUrl;
                }
              }}
              disabled={!authUrl?.authUrl}
              data-testid="button-discord-login"
            >
              <LogIn className="w-5 h-5 mr-2" />
              {t.discordLogin}
            </Button>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/30"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-card text-muted-foreground">{t.testLoginDesc}</span>
              </div>
            </div>
            
            <Button 
              className="w-full h-11 text-base shadow-md" 
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
            
            <p className="text-xs text-muted-foreground text-center mt-6">
              {language === "ja" ? "© 2024 Bot 管理ダッシュボード" : language === "en" ? "© 2024 Bot Admin Dashboard" : "© 2024 机器人管理仪表板"}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-card/30 to-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-card to-card/60 backdrop-blur-md bg-card/90 shadow-lg">
        <div className="flex items-center justify-between px-8 py-5">
          <div>
            <h1 className="text-3xl font-bold text-primary break-words leading-tight">{t.title}</h1>
            <p className="text-xs text-muted-foreground mt-1">{language === "ja" ? "サーバー管理画面" : language === "en" ? "Server Management" : "服务器管理"}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 rounded-lg border border-border/30 hover-elevate">
              {user?.avatar ? (
                <img 
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=40`}
                  alt={user.username}
                  className="w-9 h-9 rounded-full ring-2 ring-primary/30"
                  data-testid="img-user-avatar"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/50 ring-2 ring-primary/30" data-testid="div-user-avatar-fallback" />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-semibold" data-testid="text-username">{user?.username}</span>
                <span className="text-xs text-muted-foreground">{language === "ja" ? "管理者" : language === "en" ? "Admin" : "管理员"}</span>
              </div>
              <div className="w-px h-6 bg-border/50"></div>
              <Select value={language} onValueChange={(value) => setLanguage(value as "ja" | "en" | "zh")}>
                <SelectTrigger className="w-24 border-border/20 text-xs" data-testid="select-language">
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
              variant="outline" 
              size="sm" 
              className="shadow-md hover-elevate"
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
      <div className="border-b bg-gradient-to-r from-card/50 to-card/30 px-8 py-5 shadow-sm">
        <div className="max-w-6xl mx-auto">
          <div className="mb-3">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="inline-block w-1 h-4 bg-primary rounded-full"></span>
              {t.selectServer}
            </label>
          </div>
          <Select value={selectedGuildId || ""} onValueChange={setSelectedGuildId}>
            <SelectTrigger data-testid="select-guild" className="w-full max-w-sm border-primary/30 shadow-md hover:border-primary/60">
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
      <main className="p-8 max-w-6xl mx-auto">
        {!selectedGuildId ? (
          <Card className="p-12 text-center shadow-xl border border-border/30 hover-elevate">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-lg text-muted-foreground font-medium">{t.selectServerMsg}</p>
          </Card>
        ) : (
          <>
        {/* Bot Stats */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="inline-block w-1.5 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full"></span>
            {t.botStats}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <Card className="p-7 space-y-3 shadow-lg border border-border/30 hover-elevate bg-gradient-to-br from-card to-card/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.totalChats}</p>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-4xl font-bold">{botStats?.totalChats || 0}</p>
            </Card>

            <Card className="p-7 space-y-3 shadow-lg border border-border/30 hover-elevate bg-gradient-to-br from-card to-card/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.totalMessages}</p>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-4xl font-bold">{botStats?.totalMessages || 0}</p>
            </Card>

            <Card className="p-7 space-y-3 shadow-lg border border-border/30 hover-elevate bg-gradient-to-br from-card to-card/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.totalTokens}</p>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-4xl font-bold">
                {Math.floor((botStats?.totalTokens || 0) / 1000)}K
              </p>
            </Card>

            <Card className="p-7 space-y-3 shadow-lg border border-border/30 hover-elevate bg-gradient-to-br from-card to-card/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.modelCount}</p>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-4xl font-bold">{botStats?.modelCount || 0}</p>
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

        {/* Moderation Settings */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-1.5 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full"></span>
            {t.moderation}
          </h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
              <div>
                <p className="font-medium text-foreground">{moderationSettings?.enabled ? t.enabled : t.disabled}</p>
              </div>
              <Switch 
                checked={moderationSettings?.enabled || false}
                onCheckedChange={(checked) => {
                  moderationMutation.mutate({
                    ...moderationSettings,
                    enabled: checked
                  });
                }}
                disabled={moderationMutation.isPending}
                data-testid="switch-moderation-enabled"
              />
            </div>

            {moderationSettings?.enabled && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">{t.keywords}</label>
                  <textarea
                    className="w-full p-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-primary outline-none resize-none bg-background text-foreground"
                    placeholder="1行1キーワード"
                    value={(pendingModeration?.keywords || moderationSettings?.keywords || []).join('\n')}
                    onChange={(e) => {
                      setPendingModeration({
                        ...pendingModeration,
                        keywords: e.target.value.split('\n').filter((k: string) => k.trim())
                      });
                    }}
                    disabled={moderationMutation.isPending}
                    rows={5}
                    data-testid="textarea-keywords"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-2">{t.lowTimeoutMinutes}</label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={pendingModeration?.lowTimeoutMinutes ?? moderationSettings?.lowTimeoutMinutes ?? 10}
                        onChange={(e) => {
                          setPendingModeration({
                            ...pendingModeration,
                            lowTimeoutMinutes: parseInt(e.target.value)
                          });
                        }}
                        disabled={moderationMutation.isPending}
                        className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"
                        data-testid="input-low-timeout"
                      />
                      <p className="text-xs text-muted-foreground mt-1">低：キーワードマッチ時のタイムアウト</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground block mb-2">{t.mediumTimeoutMinutes}</label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={pendingModeration?.mediumTimeoutMinutes ?? moderationSettings?.mediumTimeoutMinutes ?? 30}
                        onChange={(e) => {
                          setPendingModeration({
                            ...pendingModeration,
                            mediumTimeoutMinutes: parseInt(e.target.value)
                          });
                        }}
                        disabled={moderationMutation.isPending}
                        className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"
                        data-testid="input-medium-timeout"
                      />
                      <p className="text-xs text-muted-foreground mt-1">中度：中程度の違反時のタイムアウト</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      moderationMutation.mutate({
                        ...moderationSettings,
                        ...pendingModeration
                      });
                    }}
                    disabled={moderationMutation.isPending || !pendingModeration}
                    data-testid="button-save-moderation"
                  >
                    {moderationMutation.isPending ? "保存中..." : "設定を保存"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Event Logs */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-1.5 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full"></span>
            {t.eventLogs}
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {eventLogs?.logs && eventLogs.logs.length > 0 ? (
              eventLogs.logs.map((log: BotEventLog) => {
                const iconMap = {
                  error: <AlertCircle className="h-4 w-4 text-red-500" />,
                  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
                  info: <Info className="h-4 w-4 text-blue-500" />,
                };
                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border flex gap-3 ${
                      log.type === "error"
                        ? "bg-red-500/10 border-red-500/30"
                        : log.type === "warning"
                        ? "bg-yellow-500/10 border-yellow-500/30"
                        : "bg-blue-500/10 border-blue-500/30"
                    }`}
                    data-testid={`log-entry-${log.id}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {iconMap[log.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground break-words">
                        {log.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(log.timestamp).toLocaleTimeString(language === "ja" ? "ja-JP" : language === "en" ? "en-US" : "zh-CN")}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{t.noData}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Performance Metrics */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-1.5 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full"></span>
            {t.performance}
          </h2>
          {metricsData?.metrics && metricsData.metrics.length > 0 ? (
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData.metrics.map((m: BotMetrics) => ({
                  time: new Date(m.timestamp).toLocaleTimeString(language === "ja" ? "ja-JP" : language === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" }),
                  responseTime: m.responseTime,
                  errorRate: m.totalRequests > 0 ? Math.round((m.errorCount / m.totalRequests) * 100) : 0,
                  successRate: m.totalRequests > 0 ? Math.round((m.successCount / m.totalRequests) * 100) : 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                  <YAxis stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px"
                    }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "20px" }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="responseTime"
                    stroke="hsl(var(--primary))"
                    dot={false}
                    name={t.responseTime}
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="successRate"
                    stroke="hsl(var(--primary) / 0.5)"
                    dot={false}
                    name={t.successRate}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">{t.noData}</p>
            </div>
          )}
        </Card>
          </>
        )}
      </main>
    </div>
  );
}
