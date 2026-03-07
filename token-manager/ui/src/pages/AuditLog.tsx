import { useEffect, useState } from "react";
import {
  Button,
  Chip,
  Select,
  SelectItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
} from "@heroui/react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { AuditLog as AuditLogType } from "@/types";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";

const ACTIONS = [
  "token.generate",
  "token.revoke",
  "token.revoke_all",
  "service.register",
  "service.delete",
  "user.login",
  "user.logout",
  "user.create",
  "user.update",
  "user.delete",
  "webhook.create",
  "webhook.update",
  "webhook.delete",
];

const actionColor: Record<string, "success" | "danger" | "warning" | "primary" | "default"> = {
  "token.generate": "success",
  "token.revoke": "danger",
  "token.revoke_all": "danger",
  "service.register": "primary",
  "service.delete": "danger",
  "user.login": "success",
  "user.logout": "warning",
  "user.create": "primary",
  "user.delete": "danger",
};

const PAGE_SIZE = 20;

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listAuditLogs({
        action: filter || undefined,
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

  useEffect(() => { load(); }, [page, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Auditoria</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            label="Filtrar por accion"
            className="w-full sm:max-w-xs"
            size="sm"
            selectedKeys={filter ? [filter] : []}
            onSelectionChange={(keys) => {
              setFilter(Array.from(keys)[0] as string || "");
              setPage(0);
            }}
          >
            {ACTIONS.map((a) => <SelectItem key={a}>{a}</SelectItem>)}
          </Select>
          <Tooltip content="Recargar">
            <Button isIconOnly size="sm" variant="flat" onPress={load}>
              <RefreshCw size={16} />
            </Button>
          </Tooltip>
        </div>
      </div>

      <Table aria-label="Audit logs">
        <TableHeader>
          <TableColumn>Fecha</TableColumn>
          <TableColumn>Actor</TableColumn>
          <TableColumn>Accion</TableColumn>
          <TableColumn>Recurso</TableColumn>
          <TableColumn>Detalle</TableColumn>
          <TableColumn>IP</TableColumn>
        </TableHeader>
        <TableBody
          items={logs}
          isLoading={loading}
          loadingContent={
            <div className="w-full space-y-3 p-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="w-full h-10 rounded-lg" />
              ))}
            </div>
          }
          emptyContent="Sin registros"
        >
          {(log) => (
            <TableRow key={log.id}>
              <TableCell className="text-sm text-default-400 whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString()}
              </TableCell>
              <TableCell className="font-medium">{log.actor_username}</TableCell>
              <TableCell>
                <Chip size="sm" color={actionColor[log.action] || "default"} variant="flat">
                  {log.action}
                </Chip>
              </TableCell>
              <TableCell className="text-sm">
                {log.resource_type}
                {log.resource_id ? `:${log.resource_id}` : ""}
              </TableCell>
              <TableCell className="text-xs text-default-400 max-w-xs truncate">
                {log.detail ? JSON.stringify(log.detail) : "-"}
              </TableCell>
              <TableCell className="text-sm text-default-400">{log.ip_address || "-"}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex justify-center items-center gap-2">
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          isDisabled={page === 0}
          onPress={() => setPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <Chip variant="flat" size="sm">Pagina {page + 1}</Chip>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          isDisabled={logs.length < PAGE_SIZE}
          onPress={() => setPage(page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
