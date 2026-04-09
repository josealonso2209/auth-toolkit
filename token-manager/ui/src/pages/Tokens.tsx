import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Button,
  Card,
  Chip,
  Separator,
  TextField,
  Label,
  Input,
  Modal,
  ProgressBar,
  Skeleton,
  Table,
  Tooltip,
} from "@heroui/react";
import {
  Key as KeyIcon,
  Trash2,
  ShieldCheck,
  Info,
  Copy,
  Plus,
  Search,
  Shield,
  RefreshCw,
  Server,
  Timer,
  X,
  Check,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";
import type { ActiveToken } from "@/types";

const SCOPE_OPTIONS = [
  { key: "read", label: "read" },
  { key: "write", label: "write" },
  { key: "admin", label: "admin" },
  { key: "delete", label: "delete" },
];

const columns = [
  { key: "service", label: "SERVICIO", isRowHeader: true },
  { key: "token_id", label: "TOKEN ID" },
  { key: "scopes", label: "SCOPES" },
  { key: "expires", label: "EXPIRA" },
  { key: "ttl", label: "TIEMPO RESTANTE" },
  { key: "actions", label: "ACCIONES" },
];

function formatTTL(seconds: number): string {
  if (seconds <= 0) return "Expirado";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getTTLColor(seconds: number): "success" | "warning" | "danger" {
  if (seconds <= 0) return "danger";
  if (seconds < 86400) return "danger";
  if (seconds < 604800) return "warning";
  return "success";
}

function getTTLPercent(token: ActiveToken): number {
  const created = new Date(token.created_at).getTime();
  const expires = new Date(token.expires_at).getTime();
  const totalMs = expires - created;
  if (totalMs <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, (token.ttl_seconds * 1000 / totalMs) * 100),
  );
}

const ROWS_PER_PAGE = 8;

export default function Tokens() {
  const { hasRole } = useAuthStore();
  const canManage = hasRole("admin", "operator");

  const [tokens, setTokens] = useState<ActiveToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [form, setForm] = useState({
    service_id: "",
    service_name: "",
    client_id: "",
    client_secret: "",
    scopes: ["read"] as string[],
    expiration_days: "30",
  });

  const [revokeTarget, setRevokeTarget] = useState<ActiveToken | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const data = await api.listActiveTokens();
      setTokens(data.tokens || []);
    } catch {
      toast.error("Error al cargar tokens activos");
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    setLoadingServices(true);
    try {
      const data = await api.listServices();
      setServices(data || []);
    } catch {
      /* silenciar */
    } finally {
      setLoadingServices(false);
    }
  };

  const openGenerateModal = () => {
    setForm({
      service_id: "",
      service_name: "",
      client_id: "",
      client_secret: "",
      scopes: ["read"],
      expiration_days: "30",
    });
    fetchServices();
    setGenerateOpen(true);
  };

  const onServiceSelect = (key: any) => {
    if (!key) return;
    const service = services.find((s: any) => s.service_id === String(key));
    if (service) {
      setForm({
        ...form,
        service_id: service.service_id,
        service_name: service.service_name,
        client_id: service.client_id,
        client_secret: "",
        scopes: service.allowed_scopes || ["read"],
      });
    }
  };

  const handleGenerate = async () => {
    if (!form.service_id || !form.client_id) {
      toast.warning("Selecciona un servicio registrado");
      return;
    }
    if (!form.client_secret) {
      toast.warning("Ingresa el Client Secret del servicio");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.generateToken({
        service_id: form.service_id,
        service_name: form.service_name,
        client_id: form.client_id,
        client_secret: form.client_secret,
        scopes: form.scopes,
        expiration_days: parseInt(form.expiration_days),
      });
      setGeneratedToken(res.token);
      setGenerateOpen(false);
      toast.success("Token generado correctamente");
      fetchTokens();
    } catch (err: any) {
      toast.error(err.message || "Error al generar token");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.revokeToken(revokeTarget.full_token_id);
      toast.success("Token revocado exitosamente");
      setRevokeTarget(null);
      fetchTokens();
    } catch (err: any) {
      toast.error(err.message || "Error al revocar token");
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Token ID copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const handleCopyGenerated = async () => {
    if (!generatedToken) return;
    try {
      await navigator.clipboard.writeText(generatedToken);
      setCopiedToken(true);
      toast.success("Token copiado al portapapeles");
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const filteredTokens = useMemo(() => {
    if (!filterValue) return tokens;
    const lower = filterValue.toLowerCase();
    return tokens.filter(
      (t) =>
        t.service_name.toLowerCase().includes(lower) ||
        t.service_id.toLowerCase().includes(lower) ||
        t.token_id.toLowerCase().includes(lower),
    );
  }, [tokens, filterValue]);

  const pages = Math.ceil(filteredTokens.length / ROWS_PER_PAGE);
  const paginatedTokens = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return filteredTokens.slice(start, start + ROWS_PER_PAGE);
  }, [filteredTokens, page]);

  const stats = useMemo(() => {
    const uniqueServices = new Set(tokens.map((t) => t.service_id)).size;
    const expiringSoon = tokens.filter(
      (t) => t.ttl_seconds > 0 && t.ttl_seconds < 86400,
    ).length;
    return { total: tokens.length, services: uniqueServices, expiringSoon };
  }, [tokens]);

  const toggleScope = (scope: string) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gestion de Tokens
          </h1>
          <p className="text-muted mt-1">
            Genera y administra tokens de acceso para tus servicios.
          </p>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                variant="secondary"
                onPress={fetchTokens}
                isDisabled={loading}
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Refrescar lista</Tooltip.Content>
          </Tooltip>
          {canManage && (
            <Button
              variant="primary"
              onPress={openGenerateModal}
              className="font-semibold shadow-lg shadow-accent/20"
            >
              <Plus size={18} />
              Generar Token
            </Button>
          )}
        </div>
      </div>

      {/* Alerta de token generado */}
      {generatedToken && (
        <Card className="bg-success/5 border border-success/30 shadow-lg shadow-success/5">
          <Card.Content className="py-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-success mt-1 shrink-0" size={24} />
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-success">
                    Token Generado con Exito
                  </h3>
                  <p className="text-sm text-success/80">
                    Copialo ahora. Por seguridad, no se volvera a mostrar.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2">
                  <pre className="text-sm font-mono flex-1 overflow-x-auto text-success">
                    {generatedToken}
                  </pre>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onPress={handleCopyGenerated}
                    aria-label="Copiar token"
                  >
                    {copiedToken ? <Check size={14} className="text-success" /> : <Copy size={14} className="text-success" />}
                  </Button>
                </div>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => setGeneratedToken(null)}
                className="text-success/50 hover:text-success shrink-0"
              >
                <X size={14} />
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-surface/60 backdrop-blur-lg border border-border shadow-sm hover:shadow-md transition-shadow">
          <Card.Content className="flex flex-row items-center gap-4 py-4">
            {loading ? (
              <Skeleton className="w-full h-12 rounded-lg" />
            ) : (
              <>
                <div className="p-2.5 bg-accent/10 rounded-xl ring-1 ring-accent/20 shadow-sm shadow-accent/10">
                  <KeyIcon size={20} className="text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-medium">
                    Tokens Activos
                  </p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </>
            )}
          </Card.Content>
        </Card>
        <Card className="bg-surface/60 backdrop-blur-lg border border-border shadow-sm hover:shadow-md transition-shadow">
          <Card.Content className="flex flex-row items-center gap-4 py-4">
            {loading ? (
              <Skeleton className="w-full h-12 rounded-lg" />
            ) : (
              <>
                <div className="p-2.5 bg-default/10 rounded-xl ring-1 ring-default/20 shadow-sm">
                  <Server size={20} className="text-muted" />
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-medium">
                    Servicios
                  </p>
                  <p className="text-2xl font-bold">{stats.services}</p>
                </div>
              </>
            )}
          </Card.Content>
        </Card>
        <Card className="bg-surface/60 backdrop-blur-lg border border-border shadow-sm hover:shadow-md transition-shadow">
          <Card.Content className="flex flex-row items-center gap-4 py-4">
            {loading ? (
              <Skeleton className="w-full h-12 rounded-lg" />
            ) : (
              <>
                <div
                  className={`p-2.5 rounded-xl ring-1 shadow-sm ${stats.expiringSoon > 0 ? "bg-danger/10 ring-danger/20 shadow-danger/10" : "bg-success/10 ring-success/20 shadow-success/10"}`}
                >
                  <Timer
                    size={20}
                    className={
                      stats.expiringSoon > 0 ? "text-danger" : "text-success"
                    }
                  />
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-medium">
                    Expiran en &lt;24h
                  </p>
                  <p className="text-2xl font-bold">{stats.expiringSoon}</p>
                </div>
              </>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Tabla de tokens */}
      <Card className="bg-surface/60 backdrop-blur-lg border border-border shadow-lg">
        <Card.Content className="p-0">
          <div className="p-4 pb-2">
            <TextField className="max-w-md">
              <Label className="sr-only">Buscar</Label>
              <Input
                placeholder="Buscar por servicio o token ID..."
                value={filterValue}
                onChange={(e) => {
                  setFilterValue(e.target.value);
                  setPage(1);
                }}
              />
            </TextField>
          </div>

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Tokens de servicio activos">
                <Table.Header>
                  {columns.map((col) => (
                    <Table.Column
                      key={col.key}
                      isRowHeader={col.isRowHeader}
                      className="bg-default/10 text-muted text-xs uppercase tracking-wider"
                    >
                      {col.label}
                    </Table.Column>
                  ))}
                </Table.Header>
                <Table.Body
                  items={loading ? [] : paginatedTokens}
                  renderEmptyState={() => (
                    <div className="py-12 text-center">
                      <div className="inline-flex p-4 rounded-full bg-default/10 mb-4">
                        <Shield size={40} className="text-muted/50" />
                      </div>
                      <h3 className="text-lg font-semibold text-muted mb-1">
                        Sin tokens activos
                      </h3>
                      <p className="text-muted text-sm mb-4 max-w-sm mx-auto">
                        {filterValue
                          ? "No se encontraron tokens con ese filtro."
                          : "Aun no hay tokens generados. Crea uno para empezar."}
                      </p>
                      {canManage && !filterValue && (
                        <Button
                          variant="secondary"
                          onPress={openGenerateModal}
                          size="sm"
                        >
                          <Plus size={16} />
                          Generar primer token
                        </Button>
                      )}
                    </div>
                  )}
                >
                  {(item: ActiveToken) => {
                    const ttlColor = getTTLColor(item.ttl_seconds);
                    const ttlPercent = getTTLPercent(item);
                    return (
                      <Table.Row id={item.full_token_id} key={item.full_token_id}>
                        <Table.Cell>
                          <div>
                            <p className="font-medium text-sm">{item.service_name}</p>
                            <p className="text-xs text-muted">{item.service_id}</p>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Tooltip>
                            <Tooltip.Trigger>
                              <button
                                onClick={() => handleCopy(item.full_token_id)}
                                className="font-mono text-xs bg-default/10 px-2.5 py-1 rounded-md hover:bg-default/20 transition-colors cursor-pointer"
                              >
                                {item.token_id}...
                              </button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>Clic para copiar token completo</Tooltip.Content>
                          </Tooltip>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex gap-1 flex-wrap">
                            {item.scopes.map((s) => (
                              <Chip
                                key={s}
                                size="sm"
                                variant="soft"
                                color={
                                  s === "admin"
                                    ? "danger"
                                    : s === "write" || s === "delete"
                                      ? "warning"
                                      : "accent"
                                }
                              >
                                {s}
                              </Chip>
                            ))}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="text-sm">
                            <p className="text-foreground">
                              {new Date(item.expires_at).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-xs text-muted">
                              {new Date(item.expires_at).toLocaleTimeString("es-ES", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <ProgressBar
                              value={ttlPercent}
                              color={ttlColor}
                              className="w-16"
                              aria-label="TTL restante"
                            />
                            <Chip size="sm" variant="soft" color={ttlColor}>
                              {formatTTL(item.ttl_seconds)}
                            </Chip>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-1 justify-center">
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  onPress={() => handleCopy(item.full_token_id)}
                                >
                                  <Copy size={16} className="text-muted" />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content>Copiar Token ID</Tooltip.Content>
                            </Tooltip>
                            {canManage && (
                              <Tooltip>
                                <Tooltip.Trigger>
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="ghost"
                                    onPress={() => setRevokeTarget(item)}
                                    className="text-danger"
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </Tooltip.Trigger>
                                <Tooltip.Content>Revocar token</Tooltip.Content>
                              </Tooltip>
                            )}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  }}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            {pages > 1 && (
              <Table.Footer>
                <div className="flex justify-center items-center gap-2 py-2">
                  <Button isIconOnly size="sm" variant="secondary" isDisabled={page <= 1} onPress={() => setPage(page - 1)}>
                    <span className="text-xs">&lt;</span>
                  </Button>
                  <Chip size="sm" variant="soft">Pagina {page} de {pages}</Chip>
                  <Button isIconOnly size="sm" variant="secondary" isDisabled={page >= pages} onPress={() => setPage(page + 1)}>
                    <span className="text-xs">&gt;</span>
                  </Button>
                </div>
              </Table.Footer>
            )}
          </Table>
        </Card.Content>
      </Card>

      {/* Tips de seguridad */}
      <Card className="bg-accent/5 border border-accent/10">
        <Card.Content className="p-5">
          <div className="flex gap-3">
            <Info className="text-accent shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-accent">
                Consejos de Seguridad
              </h4>
              <ul className="text-xs space-y-1 text-muted list-disc ml-4">
                <li>Usa el tiempo de expiracion mas corto posible.</li>
                <li>Asigna solo los scopes estrictamente necesarios.</li>
                <li>Revoca inmediatamente tokens comprometidos.</li>
                <li>
                  Los tokens son opacos y se almacenan en Redis con TTL
                  automatico.
                </li>
              </ul>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Modal generar token */}
      {generateOpen && (
        <Modal>
          <Modal.Backdrop isOpen={generateOpen} onOpenChange={(open) => !open && setGenerateOpen(false)} variant="blur">
            <Modal.Container size="lg">
              <Modal.Dialog>
                <Modal.Header className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <KeyIcon className="text-accent" size={20} />
                  </div>
                  <div>
                    <Modal.Heading className="text-lg font-bold">Generar Nuevo Token</Modal.Heading>
                    <p className="text-xs text-muted font-normal">
                      Selecciona un servicio registrado y proporciona su Client Secret
                    </p>
                  </div>
                </Modal.Header>
                <Modal.Body>
                  <div className="space-y-5">
                    {/* Service selector */}
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Servicio <span className="text-danger">*</span></label>
                      <select
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        value={form.service_id}
                        onChange={(e) => onServiceSelect(e.target.value)}
                        disabled={loadingServices}
                      >
                        <option value="">Selecciona un servicio...</option>
                        {services.map((item: any) => (
                          <option key={item.service_id} value={item.service_id}>
                            {item.service_name} ({item.service_id})
                          </option>
                        ))}
                      </select>
                      {services.length === 0 && !loadingServices && (
                        <p className="text-xs text-muted mt-1">No hay servicios registrados. Registra uno primero en Servicios.</p>
                      )}
                    </div>

                    {/* Service info (read-only) */}
                    {form.service_id && (
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-default/5 border border-border">
                        <div>
                          <p className="text-xs text-muted">Service ID</p>
                          <p className="text-sm font-medium">{form.service_id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">Client ID</p>
                          <code className="text-xs">{form.client_id}</code>
                        </div>
                      </div>
                    )}

                    <Separator />

                    <TextField isRequired isDisabled={!form.service_id}>
                      <Label>Client Secret</Label>
                      <Input
                        type="password"
                        placeholder="Ingresa el client secret del servicio"
                        value={form.client_secret}
                        onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                      />
                    </TextField>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Scopes (Permisos)</label>
                        <div className="flex flex-wrap gap-2">
                          {SCOPE_OPTIONS.map((s) => (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => toggleScope(s.key)}
                              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                                form.scopes.includes(s.key)
                                  ? "bg-accent text-accent-foreground border-accent"
                                  : "bg-surface border-border text-muted hover:border-accent/50"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <TextField>
                        <Label>Expiracion (dias)</Label>
                        <Input
                          type="number"
                          value={form.expiration_days}
                          onChange={(e) => setForm({ ...form, expiration_days: e.target.value })}
                          min={1}
                          max={365}
                        />
                      </TextField>
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer className="border-t border-border pt-4">
                  <Button
                    variant="secondary"
                    onPress={() => setGenerateOpen(false)}
                    isDisabled={generating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    isPending={generating}
                    onPress={handleGenerate}
                    className="font-semibold shadow-lg shadow-accent/20"
                  >
                    Generar Token de Acceso
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}

      {/* Modal confirmar revocacion */}
      <ConfirmModal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revocar Token"
        message={`Estas seguro de revocar el token ${revokeTarget?.token_id}... del servicio "${revokeTarget?.service_name}"? Esta accion es irreversible.`}
        confirmLabel="Revocar"
        confirmColor="danger"
        loading={revoking}
      />
    </div>
  );
}
