import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Card, Chip, Skeleton, Table, Tooltip } from "@heroui/react";
import {
  ArrowLeft,
  Server,
  Shield,
  Clock,
  Key,
  ScrollText,
  Lock,
  Unlock,
  Activity,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin");

  const [service, setService] = useState<any>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [servicesData, tokensData, auditData] = await Promise.allSettled([
        api.listServices(),
        api.listActiveTokens(),
        isAdmin
          ? api.listAuditLogs({ resource_id: id, limit: 15 })
          : Promise.resolve([]),
      ]);

      const services =
        servicesData.status === "fulfilled" ? servicesData.value : [];
      setAllServices(services);
      const found = services.find((s: any) => s.service_id === id);
      setService(found || null);

      if (tokensData.status === "fulfilled") {
        const all = tokensData.value.tokens || [];
        setTokens(all.filter((t: any) => t.service_id === id));
      }

      if (auditData.status === "fulfilled") {
        setAuditLogs(auditData.value as any[]);
      }
    } catch {
      toast.error("Error al cargar detalle del servicio");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-center py-20 space-y-4">
        <Server size={48} className="mx-auto text-muted" />
        <p className="text-lg text-muted">Servicio no encontrado</p>
        <Button variant="secondary" onPress={() => navigate("/services")}>
          <ArrowLeft size={16} /> Volver a Servicios
        </Button>
      </div>
    );
  }

  const isLocked = service.is_active === false;
  const activeTokenCount = tokens.length;

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  const actionLabels: Record<string, string> = {
    "service.register": "Registrado",
    "service.delete": "Eliminado",
    "service.lock": "Bloqueado",
    "service.unlock": "Desbloqueado",
    "token.generate": "Token generado",
    "token.revoke": "Token revocado",
    "token.revoke_all": "Kill switch",
    "token.test": "Token verificado",
    "webhook.retry": "Webhook reintentado",
  };

  const actionColors: Record<string, string> = {
    "service.lock": "danger",
    "service.delete": "danger",
    "token.revoke_all": "danger",
    "token.revoke": "warning",
    "service.register": "success",
    "service.unlock": "success",
    "token.generate": "primary",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          isIconOnly
          variant="ghost"
          onPress={() => navigate("/services")}
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight truncate">
              {service.service_name}
            </h1>
            <Chip
              size="sm"
              color={isLocked ? "danger" : "success"}
              variant="soft"
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
                  isLocked ? "bg-danger" : "bg-success animate-pulse"
                }`}
              />
              {isLocked ? "Bloqueado" : "Activo"}
            </Chip>
          </div>
          <p className="text-sm text-muted mt-0.5">
            <code className="bg-default/10 px-1.5 py-0.5 rounded text-xs">
              {service.service_id}
            </code>
            {service.description && (
              <span className="ml-2">{service.description}</span>
            )}
          </p>
        </div>
        <Button
          isIconOnly
          variant="ghost"
          onPress={loadAll}
          aria-label="Refrescar"
        >
          <RefreshCw size={18} />
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Key size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeTokenCount}</p>
              <p className="text-xs text-muted">Tokens activos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Shield size={18} className="text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {(service.allowed_scopes || []).length}
              </p>
              <p className="text-xs text-muted">Scopes</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Activity size={18} className="text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {service.rate_limit > 0
                  ? `${service.rate_limit}`
                  : "\u221E"}
              </p>
              <p className="text-xs text-muted">Rate limit/min</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10">
              <ScrollText size={18} className="text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{auditLogs.length}</p>
              <p className="text-xs text-muted">Eventos recientes</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main content: Info + Topology */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service info */}
        <Card>
          <Card.Header className="flex gap-2 px-6 pt-5">
            <Server size={18} className="text-accent" />
            <h2 className="text-lg font-bold">Configuracion</h2>
          </Card.Header>
          <Card.Content className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted text-xs mb-1">Client ID</p>
                <code className="bg-default/10 px-2 py-1 rounded text-xs block truncate">
                  {service.client_id}
                </code>
              </div>
              <div>
                <p className="text-muted text-xs mb-1">Rate Limit</p>
                <p className="font-medium">
                  {service.rate_limit > 0
                    ? `${service.rate_limit} req/min`
                    : "Sin limite"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-muted text-xs mb-2">Scopes permitidos</p>
              <div className="flex flex-wrap gap-1.5">
                {(service.allowed_scopes || []).map((scope: string) => (
                  <Chip key={scope} size="sm" variant="soft" className="text-xs">
                    {scope}
                  </Chip>
                ))}
              </div>
            </div>
            {service.created_at && (
              <div>
                <p className="text-muted text-xs mb-1">Registrado</p>
                <p className="text-sm">{formatDate(service.created_at)}</p>
              </div>
            )}
          </Card.Content>
        </Card>

        {/* Topology */}
        <Card>
          <Card.Header className="flex gap-2 px-6 pt-5">
            <Activity size={18} className="text-accent" />
            <h2 className="text-lg font-bold">Topologia</h2>
          </Card.Header>
          <Card.Content className="p-6">
            <TopologyDiagram
              services={allServices}
              currentServiceId={id!}
            />
          </Card.Content>
        </Card>
      </div>

      {/* Active tokens */}
      <Card className="shadow-sm overflow-hidden">
        <Card.Header className="flex gap-2 px-6 pt-5">
          <Key size={18} className="text-accent" />
          <h2 className="text-lg font-bold">Tokens activos</h2>
          <Chip size="sm" variant="soft" className="ml-auto">
            {activeTokenCount}
          </Chip>
        </Card.Header>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Tokens activos del servicio">
              <Table.Header>
                <Table.Column isRowHeader>TOKEN ID</Table.Column>
                <Table.Column>SCOPES</Table.Column>
                <Table.Column>CREADO</Table.Column>
                <Table.Column>EXPIRA</Table.Column>
                <Table.Column>TTL</Table.Column>
              </Table.Header>
              <Table.Body
                items={tokens}
                renderEmptyState={() => (
                  <p className="text-center py-6 text-muted">
                    No hay tokens activos para este servicio.
                  </p>
                )}
              >
                {(token: any) => (
                  <Table.Row key={token.token_id} id={token.token_id}>
                    <Table.Cell>
                      <code className="text-xs bg-default/10 px-1.5 py-0.5 rounded">
                        {token.token_id}
                      </code>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">
                        {(token.scopes || []).map((s: string) => (
                          <Chip
                            key={s}
                            size="sm"
                            variant="soft"
                            className="text-xs h-5"
                          >
                            {s}
                          </Chip>
                        ))}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-xs">
                      {formatDate(token.created_at)}
                    </Table.Cell>
                    <Table.Cell className="text-xs">
                      {formatDate(token.expires_at)}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-1 text-xs">
                        <Clock size={12} className="text-muted" />
                        {Math.round(token.ttl_seconds / 60)}m
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card>

      {/* Audit log */}
      {isAdmin && (
        <Card className="shadow-sm overflow-hidden">
          <Card.Header className="flex gap-2 px-6 pt-5">
            <ScrollText size={18} className="text-accent" />
            <h2 className="text-lg font-bold">Historial de auditoria</h2>
          </Card.Header>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Auditoria del servicio">
                <Table.Header>
                  <Table.Column isRowHeader>FECHA</Table.Column>
                  <Table.Column>ACCION</Table.Column>
                  <Table.Column>USUARIO</Table.Column>
                  <Table.Column>DETALLE</Table.Column>
                </Table.Header>
                <Table.Body
                  items={auditLogs}
                  renderEmptyState={() => (
                    <p className="text-center py-6 text-muted">
                      No hay eventos de auditoria.
                    </p>
                  )}
                >
                  {(log: any) => (
                    <Table.Row key={log.id} id={String(log.id)}>
                      <Table.Cell className="text-xs whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          size="sm"
                          color={
                            (actionColors[log.action] as any) || "default"
                          }
                          variant="soft"
                          className="text-xs"
                        >
                          {actionLabels[log.action] || log.action}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-sm">
                        {log.actor_username}
                      </Table.Cell>
                      <Table.Cell className="text-xs text-muted max-w-[200px] truncate">
                        {log.detail
                          ? JSON.stringify(log.detail)
                          : "\u2014"}
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card>
      )}
    </div>
  );
}

/* ─── Topology Diagram ─── */

function TopologyDiagram({
  services,
  currentServiceId,
}: {
  services: any[];
  currentServiceId: string;
}) {
  const total = services.length;
  if (total === 0) return <p className="text-muted text-sm">Sin servicios</p>;

  const cx = 200;
  const cy = 140;
  const hubR = 36;
  const nodeR = 26;
  const orbitR = 100;

  const nodes = services.map((svc, i) => {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2;
    return {
      ...svc,
      x: cx + orbitR * Math.cos(angle),
      y: cy + orbitR * Math.sin(angle),
      isCurrent: svc.service_id === currentServiceId,
      isLocked: svc.is_active === false,
    };
  });

  return (
    <svg viewBox="0 0 400 280" className="w-full h-auto">
      {/* Connection lines */}
      {nodes.map((node) => (
        <line
          key={`line-${node.service_id}`}
          x1={cx}
          y1={cy}
          x2={node.x}
          y2={node.y}
          className={
            node.isCurrent
              ? "stroke-accent"
              : node.isLocked
                ? "stroke-danger/40"
                : "stroke-border"
          }
          strokeWidth={node.isCurrent ? 2.5 : 1.5}
          strokeDasharray={node.isLocked ? "4 3" : undefined}
        />
      ))}

      {/* Hub: auth-service */}
      <circle cx={cx} cy={cy} r={hubR} className="fill-accent/15 stroke-accent" strokeWidth={2} />
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-[9px] font-bold">
        auth
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" className="fill-foreground text-[9px] font-bold">
        service
      </text>

      {/* Service nodes */}
      {nodes.map((node) => (
        <g key={node.service_id}>
          <circle
            cx={node.x}
            cy={node.y}
            r={nodeR}
            className={
              node.isCurrent
                ? "fill-accent/20 stroke-accent"
                : node.isLocked
                  ? "fill-danger/10 stroke-danger/50"
                  : "fill-surface stroke-border"
            }
            strokeWidth={node.isCurrent ? 2.5 : 1.5}
          />
          {node.isLocked && (
            <text
              x={node.x}
              y={node.y - 6}
              textAnchor="middle"
              className="fill-danger text-[10px]"
            >
              &#x1F512;
            </text>
          )}
          <text
            x={node.x}
            y={node.isLocked ? node.y + 7 : node.y + 3}
            textAnchor="middle"
            className={`text-[8px] font-medium ${
              node.isCurrent ? "fill-accent" : "fill-muted"
            }`}
          >
            {node.service_name.length > 10
              ? node.service_name.slice(0, 9) + "\u2026"
              : node.service_name}
          </text>
        </g>
      ))}
    </svg>
  );
}
