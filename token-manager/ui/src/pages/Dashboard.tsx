import { useEffect, useState } from "react";
import { Card, Chip, Skeleton } from "@heroui/react";
import { Activity, ScrollText, Shield, Clock, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import * as api from "@/api/client";

const CRITICAL_WINDOW_HOURS = 24;

interface Stats {
  authServiceStatus: string | null;
  authServiceUptime: number | null;
  auditTotal: number;
  lastActions: any[];
  lockedServices: any[];
  recentCritical: any[];
}

export default function Dashboard() {
  const { user, hasRole } = useAuthStore();
  const canSeeIncidents = hasRole("admin", "operator");
  const [stats, setStats] = useState<Stats>({
    authServiceStatus: null,
    authServiceUptime: null,
    auditTotal: 0,
    lastActions: [],
    lockedServices: [],
    recentCritical: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [tokenStatus, auditCount, recentLogs, services, criticalLogs] =
        await Promise.allSettled([
          api.listTokensStatus(),
          api.countAuditLogs().catch(() => ({ total: 0 })),
          api.listAuditLogs({ limit: 8 }).catch(() => []),
          canSeeIncidents
            ? api.listServices().catch(() => [])
            : Promise.resolve([]),
          hasRole("admin")
            ? api
                .listAuditLogs({ critical: true, limit: 20 })
                .catch(() => [])
            : Promise.resolve([]),
        ]);

      const authData =
        tokenStatus.status === "fulfilled"
          ? tokenStatus.value.auth_service_status
          : null;

      const allServices =
        services.status === "fulfilled" ? services.value : [];
      const locked = (allServices || []).filter(
        (s: any) => s.is_active === false,
      );

      const cutoff = Date.now() - CRITICAL_WINDOW_HOURS * 3600 * 1000;
      const allCritical =
        criticalLogs.status === "fulfilled" ? criticalLogs.value : [];
      const recentCritical = (allCritical || []).filter(
        (l: any) => new Date(l.timestamp).getTime() >= cutoff,
      );

      setStats({
        authServiceStatus: authData?.status || "error",
        authServiceUptime: authData?.uptime_seconds || null,
        auditTotal:
          auditCount.status === "fulfilled" ? auditCount.value.total : 0,
        lastActions:
          recentLogs.status === "fulfilled" ? recentLogs.value : [],
        lockedServices: locked,
        recentCritical,
      });
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number | null) => {
    if (!seconds) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    return `${h}h ${m}m`;
  };

  const isHealthy = stats.authServiceStatus === "healthy";
  const hasLocked = stats.lockedServices.length > 0;
  const hasRecentCritical = stats.recentCritical.length > 0;
  const showIncidentBanner = !loading && (hasLocked || hasRecentCritical);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted mt-1">
          Bienvenido, {user?.username}
          <Chip size="sm" variant="soft" className="ml-2 capitalize">
            {user?.role}
          </Chip>
        </p>
      </div>

      {/* Banner de incidente */}
      {showIncidentBanner && (
        <Card className="bg-danger/5 border border-danger/30 shadow-lg shadow-danger/5">
          <Card.Content className="py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-danger/10 rounded-lg ring-1 ring-danger/30 animate-pulse">
                <ShieldAlert className="text-danger" size={22} />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h3 className="font-semibold text-danger">
                    Atencion: actividad de seguridad detectada
                  </h3>
                  <p className="text-xs text-danger/80">
                    Revisa los siguientes elementos antes de continuar.
                  </p>
                </div>
                <ul className="text-sm space-y-1.5">
                  {hasLocked && (
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                      <span>
                        <strong>{stats.lockedServices.length}</strong>{" "}
                        servicio{stats.lockedServices.length === 1 ? "" : "s"}{" "}
                        bloqueado{stats.lockedServices.length === 1 ? "" : "s"}:{" "}
                        <span className="text-muted">
                          {stats.lockedServices
                            .slice(0, 3)
                            .map((s: any) => s.service_name)
                            .join(", ")}
                          {stats.lockedServices.length > 3 &&
                            ` +${stats.lockedServices.length - 3} mas`}
                        </span>
                        {" — "}
                        <Link
                          to="/services"
                          className="text-danger underline hover:text-danger/80"
                        >
                          gestionar
                        </Link>
                      </span>
                    </li>
                  )}
                  {hasRecentCritical && (
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                      <span>
                        <strong>{stats.recentCritical.length}</strong> evento
                        {stats.recentCritical.length === 1 ? "" : "s"} critico
                        {stats.recentCritical.length === 1 ? "" : "s"} en las
                        ultimas {CRITICAL_WINDOW_HOURS}h
                        {" — "}
                        <Link
                          to="/audit"
                          className="text-danger underline hover:text-danger/80"
                        >
                          ver auditoria
                        </Link>
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Auth Service Status */}
        <Card>
          <Card.Content className="flex flex-row items-center gap-4">
            {loading ? (
              <Skeleton className="w-full h-14 rounded-lg" />
            ) : (
              <>
                <div className={`p-3 rounded-lg ${isHealthy ? "bg-success/10" : "bg-danger/10"}`}>
                  <Activity size={24} className={isHealthy ? "text-success" : "text-danger"} />
                </div>
                <div>
                  <p className="text-sm text-muted">Auth Service</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold capitalize">{stats.authServiceStatus}</p>
                    <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-success animate-pulse" : "bg-danger"}`} />
                  </div>
                </div>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Uptime */}
        <Card>
          <Card.Content className="flex flex-row items-center gap-4">
            {loading ? (
              <Skeleton className="w-full h-14 rounded-lg" />
            ) : (
              <>
                <div className="p-3 rounded-lg bg-accent/10">
                  <Clock size={24} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted">Uptime</p>
                  <p className="text-xl font-bold">{formatUptime(stats.authServiceUptime)}</p>
                </div>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Audit events */}
        <Card>
          <Card.Content className="flex flex-row items-center gap-4">
            {loading ? (
              <Skeleton className="w-full h-14 rounded-lg" />
            ) : (
              <>
                <div className="p-3 rounded-lg bg-default/10">
                  <ScrollText size={24} className="text-muted" />
                </div>
                <div>
                  <p className="text-sm text-muted">Eventos de auditoria</p>
                  <p className="text-xl font-bold">{stats.auditTotal.toLocaleString()}</p>
                </div>
              </>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <Card.Header className="pb-0">
          <h2 className="text-lg font-semibold">Actividad reciente</h2>
        </Card.Header>
        <Card.Content>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="w-full h-12 rounded-lg" />
              ))}
            </div>
          ) : stats.lastActions.length === 0 ? (
            <div className="text-center py-8">
              <Shield size={40} className="mx-auto text-muted/50 mb-3" />
              <p className="text-muted">Sin actividad registrada</p>
            </div>
          ) : (
            <div className="space-y-1">
              {stats.lastActions.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-default/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Chip
                      size="sm"
                      variant="soft"
                      color={
                        log.action.includes("generate") || log.action.includes("login") || log.action.includes("create")
                          ? "success"
                          : log.action.includes("revoke") || log.action.includes("delete")
                          ? "danger"
                          : "default"
                      }
                      className="min-w-fit"
                    >
                      {log.action}
                    </Chip>
                    <p className="text-sm text-muted truncate">
                      {log.actor_username}
                      {log.resource_id ? ` — ${log.resource_type}:${log.resource_id}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-muted whitespace-nowrap ml-4">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
