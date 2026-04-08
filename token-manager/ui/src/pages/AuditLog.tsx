import { useEffect, useState } from "react";
import {
  Button,
  Chip,
  Skeleton,
  Table,
  Tooltip,
} from "@heroui/react";
import { ChevronLeft, ChevronRight, RefreshCw, ShieldAlert } from "lucide-react";
import type { AuditLog as AuditLogType } from "@/types";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";

const ACTIONS = [
  "token.generate",
  "token.revoke",
  "token.revoke_all",
  "service.register",
  "service.delete",
  "service.lock",
  "service.unlock",
  "user.login",
  "user.logout",
  "user.create",
  "user.update",
  "user.delete",
  "webhook.create",
  "webhook.update",
  "webhook.delete",
];

const CRITICAL_ACTIONS = new Set([
  "token.revoke_all",
  "service.delete",
  "service.lock",
]);

const actionColor: Record<string, "success" | "danger" | "warning" | "accent" | "default"> = {
  "token.generate": "success",
  "token.revoke": "danger",
  "token.revoke_all": "danger",
  "service.register": "accent",
  "service.delete": "danger",
  "service.lock": "danger",
  "service.unlock": "warning",
  "user.login": "success",
  "user.logout": "warning",
  "user.create": "accent",
  "user.delete": "danger",
};

const PAGE_SIZE = 20;

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<string>("");
  const [criticalOnly, setCriticalOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listAuditLogs({
        action: criticalOnly ? undefined : (filter || undefined),
        critical: criticalOnly || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setLogs(data);
    } catch {
      toast.error("Error al cargar registros de auditoria");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, filter, criticalOnly]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Auditoria</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Tooltip>
            <Tooltip.Trigger>
              <button
                type="button"
                onClick={() => {
                  setCriticalOnly((v) => !v);
                  setPage(0);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  criticalOnly
                    ? "bg-danger/10 border-danger/40 text-danger"
                    : "bg-surface border-border text-muted hover:border-danger/40"
                }`}
              >
                <ShieldAlert size={15} />
                Solo criticos
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>
              Filtra revoke_all, service.delete y service.lock
            </Tooltip.Content>
          </Tooltip>
          <select
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent w-full sm:max-w-xs disabled:opacity-50"
            value={filter}
            disabled={criticalOnly}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas las acciones</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <Tooltip>
            <Tooltip.Trigger>
              <Button isIconOnly size="sm" variant="secondary" onPress={load}>
                <RefreshCw size={16} />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Recargar</Tooltip.Content>
          </Tooltip>
        </div>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Audit logs">
            <Table.Header>
              <Table.Column isRowHeader>Fecha</Table.Column>
              <Table.Column>Actor</Table.Column>
              <Table.Column>Accion</Table.Column>
              <Table.Column>Recurso</Table.Column>
              <Table.Column>Detalle</Table.Column>
              <Table.Column>IP</Table.Column>
            </Table.Header>
            <Table.Body
              items={logs}
              renderEmptyState={() => (
                loading ? (
                  <div className="w-full space-y-3 p-4">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="w-full h-10 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted">Sin registros</p>
                )
              )}
            >
              {(log: AuditLogType) => {
                const isCritical = CRITICAL_ACTIONS.has(log.action);
                return (
                <Table.Row
                  key={log.id}
                  id={String(log.id)}
                  className={isCritical ? "bg-danger/5" : ""}
                >
                  <Table.Cell className="text-sm text-muted whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </Table.Cell>
                  <Table.Cell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {isCritical && (
                        <ShieldAlert size={14} className="text-danger shrink-0" />
                      )}
                      {log.actor_username}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" color={actionColor[log.action] || "default"} variant="soft">
                      {log.action}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell className="text-sm">
                    {log.resource_type}
                    {log.resource_id ? `:${log.resource_id}` : ""}
                  </Table.Cell>
                  <Table.Cell className="text-xs text-muted max-w-xs truncate">
                    {log.detail ? JSON.stringify(log.detail) : "-"}
                  </Table.Cell>
                  <Table.Cell className="text-sm text-muted">{log.ip_address || "-"}</Table.Cell>
                </Table.Row>
                );
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <div className="flex justify-center items-center gap-2">
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          isDisabled={page === 0}
          onPress={() => setPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <Chip variant="soft" size="sm">Pagina {page + 1}</Chip>
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          isDisabled={logs.length < PAGE_SIZE}
          onPress={() => setPage(page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
