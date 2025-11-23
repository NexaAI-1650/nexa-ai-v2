import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, MessageSquare, Users, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { Conversation } from "@shared/schema";

export default function AdminDashboard() {
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
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

        {/* Recent Chats */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">最近のチャット</h2>
          <div className="space-y-3">
            {conversations.slice(0, 10).map((conv) => (
              <div
                key={conv.id}
                className="p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium truncate">{conv.title}</p>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{conv.messages?.length || 0} メッセージ</span>
                  <span className="font-mono">{conv.model || "unknown"}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
