import { useEffect, useState } from "react";
import { Card, Chip, Skeleton, Button } from "@heroui/react";
import { Cog, RefreshCw, Clock, Zap, CheckCircle, XCircle } from "lucide-react";
import * as api from "@/api/client";

interface Worker {
  name: string;
  status: string;
  active_tasks: number;
  scheduled_tasks: number;
  total_tasks_executed: number;
  pool: string;
}

interface BeatEntry {
  task: string;
  schedule: string;
}

interface CeleryData {
  status: string;
  detail?: string;
  workers: Worker[];
  beat_schedule?: Record<string, BeatEntry>;
}

export default function Workers() {
  const [data, setData] = useState<CeleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await api.getCeleryStatus();
      setData(res);
    } catch {
      setData({ status: "error", detail: "No se pudo conectar", workers: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  const scheduleLabels: Record<string, string> = {
    "check-token-expiration": "Detectar tokens expirados o por expirar",
    "cleanup-expired-sessions": "Limpiar sesiones admin expiradas",
    "cleanup-old-deliveries": "Purgar deliveries de webhooks >30 dias",
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const statusColor =
    data?.status === "ok"
      ? "success"
      : data?.status === "no_workers"
        ? "warning"
        : "danger";

  const statusLabel =
    data?.status === "ok"
      ? "Operativo"
      : data?.status === "no_workers"
        ? "Sin workers"
        : "Error";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workers</h1>
          <p className="text-sm text-muted mt-1">
            Estado del cluster Celery — tareas en background y schedule
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Chip color={statusColor} variant="soft">
            {statusLabel}
          </Chip>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            onPress={refresh}
            aria-label="Refrescar"
            isDisabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {data?.detail && (
        <Card className="p-4 border-danger/50 bg-danger/5">
          <p className="text-sm text-danger">{data.detail}</p>
        </Card>
      )}

      {/* Workers */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Workers activos</h2>
        {data?.workers && data.workers.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.workers.map((w) => (
              <Card key={w.name} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cog size={18} className="text-accent" />
                    <span className="font-medium text-sm truncate">{w.name}</span>
                  </div>
                  <Chip
                    color={w.status === "online" ? "success" : "danger"}
                    variant="soft"
                    size="sm"
                  >
                    {w.status}
                  </Chip>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted">
                    <Zap size={14} />
                    <span>Activas</span>
                  </div>
                  <span className="text-right font-mono">{w.active_tasks}</span>

                  <div className="flex items-center gap-1.5 text-muted">
                    <Clock size={14} />
                    <span>Programadas</span>
                  </div>
                  <span className="text-right font-mono">{w.scheduled_tasks}</span>

                  <div className="flex items-center gap-1.5 text-muted">
                    <CheckCircle size={14} />
                    <span>Ejecutadas</span>
                  </div>
                  <span className="text-right font-mono">{w.total_tasks_executed}</span>
                </div>

                {w.pool && (
                  <p className="text-xs text-muted">
                    Pool: <span className="font-mono">{w.pool}</span>
                  </p>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center">
            <XCircle size={32} className="mx-auto text-warning mb-2" />
            <p className="text-sm text-muted">
              No hay workers conectados. Verifica que el servicio{" "}
              <code className="text-xs bg-default/40 px-1 py-0.5 rounded">celery-worker</code>{" "}
              este corriendo.
            </p>
          </Card>
        )}
      </div>

      {/* Beat Schedule */}
      {data?.beat_schedule && Object.keys(data.beat_schedule).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Tareas programadas (Beat)</h2>
          <div className="space-y-2">
            {Object.entries(data.beat_schedule).map(([name, entry]) => (
              <Card key={name} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-xs text-muted">
                    {scheduleLabels[name] || entry.task}
                  </p>
                </div>
                <Chip size="sm" variant="soft">
                  {entry.schedule}
                </Chip>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <Card className="p-4 bg-default/20">
        <h3 className="text-sm font-semibold mb-2">Tareas Celery</h3>
        <ul className="text-xs text-muted space-y-1 list-disc list-inside">
          <li>
            <strong>deliver_webhook</strong> — Entrega webhooks en background (antes era sincrono y bloqueaba la API)
          </li>
          <li>
            <strong>check_token_expiration</strong> — Cada 5 min detecta tokens expirados/por expirar y dispara eventos webhook
          </li>
          <li>
            <strong>cleanup_expired_sessions</strong> — Cada hora elimina sesiones admin expiradas
          </li>
          <li>
            <strong>cleanup_old_deliveries</strong> — Diario a las 3 AM UTC purga deliveries de mas de 30 dias
          </li>
        </ul>
      </Card>
    </div>
  );
}
