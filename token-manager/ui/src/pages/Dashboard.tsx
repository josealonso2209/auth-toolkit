import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { Key, Server, ScrollText, Activity } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import * as api from "@/api/client";

interface Stats {
  authServiceStatus: string | null;
  auditTotal: number;
  lastActions: any[];
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats>({
    authServiceStatus: null,
    auditTotal: 0,
    lastActions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [tokenStatus, auditCount, recentLogs] = await Promise.allSettled([
        api.listTokensStatus(),
        api.countAuditLogs().catch(() => ({ total: 0 })),
        api.listAuditLogs({ limit: 5 }).catch(() => []),
      ]);

      setStats({
        authServiceStatus:
          tokenStatus.status === "fulfilled"
            ? tokenStatus.value.auth_service_status?.status
            : "error",
        auditTotal:
          auditCount.status === "fulfilled" ? auditCount.value.total : 0,
        lastActions:
          recentLogs.status === "fulfilled" ? recentLogs.value : [],
      });
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      title: "Auth Service",
      value: stats.authServiceStatus || "...",
      icon: Activity,
      color: stats.authServiceStatus === "healthy" ? "success" : "danger",
    },
    {
      title: "Eventos de auditoria",
      value: String(stats.auditTotal),
      icon: ScrollText,
      color: "primary",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-default-500 mt-1">
          Bienvenido, {user?.username}
          <Chip size="sm" variant="flat" className="ml-2 capitalize">
            {user?.role}
          </Chip>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardBody className="flex flex-row items-center gap-4">
              <div
                className={`p-3 rounded-lg bg-${card.color}/10`}
              >
                <card.icon size={24} className={`text-${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-default-500">{card.title}</p>
                <p className="text-2xl font-bold capitalize">{card.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {stats.lastActions.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Actividad reciente</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {stats.lastActions.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b border-divider last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-default-400">
                      {log.actor_username} &middot; {log.resource_type}
                      {log.resource_id ? `:${log.resource_id}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-default-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
