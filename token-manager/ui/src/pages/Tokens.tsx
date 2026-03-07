import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Pagination,
  Progress,
  Select,
  SelectItem,
  Skeleton,
  Snippet,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  Autocomplete,
  AutocompleteItem,
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
  { key: "service", label: "SERVICIO" },
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
    scopes: new Set<string>(["read"]),
    expiration_days: "30",
  });

  const [revokeTarget, setRevokeTarget] = useState<ActiveToken | null>(null);
  const [revoking, setRevoking] = useState(false);

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
      scopes: new Set(["read"]),
      expiration_days: "30",
    });
    fetchServices();
    setGenerateOpen(true);
  };

  const onServiceSelect = (key: React.Key | null) => {
    if (!key) return;
    const service = services.find((s: any) => s.service_id === key);
    if (service) {
      setForm({
        ...form,
        service_id: service.service_id,
        service_name: service.service_name,
        client_id: service.client_id,
        client_secret: "",
        scopes: new Set(service.allowed_scopes || ["read"]),
      });
    }
  };

  const handleGenerate = async () => {
    if (
      !form.service_id ||
      !form.service_name ||
      !form.client_id ||
      !form.client_secret
    ) {
      toast.warning("Completa todos los campos requeridos");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.generateToken({
        service_id: form.service_id,
        service_name: form.service_name,
        client_id: form.client_id,
        client_secret: form.client_secret,
        scopes: Array.from(form.scopes),
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

  const renderCell = useCallback(
    (token: ActiveToken, columnKey: React.Key) => {
      switch (columnKey) {
        case "service":
          return (
            <div>
              <p className="font-medium text-sm">{token.service_name}</p>
              <p className="text-xs text-default-400">{token.service_id}</p>
            </div>
          );
        case "token_id":
          return (
            <Tooltip content="Clic para copiar token completo" placement="top">
              <button
                onClick={() => handleCopy(token.full_token_id)}
                className="font-mono text-xs bg-default-100 dark:bg-default-50 px-2.5 py-1 rounded-md hover:bg-default-200 dark:hover:bg-default-100 transition-colors cursor-pointer"
              >
                {token.token_id}...
              </button>
            </Tooltip>
          );
        case "scopes":
          return (
            <div className="flex gap-1 flex-wrap">
              {token.scopes.map((s) => (
                <Chip
                  key={s}
                  size="sm"
                  variant="flat"
                  color={
                    s === "admin"
                      ? "danger"
                      : s === "write" || s === "delete"
                        ? "warning"
                        : "primary"
                  }
                >
                  {s}
                </Chip>
              ))}
            </div>
          );
        case "expires":
          return (
            <div className="text-sm">
              <p className="text-default-600">
                {new Date(token.expires_at).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-default-400">
                {new Date(token.expires_at).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          );
        case "ttl": {
          const ttlColor = getTTLColor(token.ttl_seconds);
          const ttlPercent = getTTLPercent(token);
          return (
            <div className="flex items-center gap-2 min-w-[140px]">
              <Progress
                size="sm"
                value={ttlPercent}
                color={ttlColor}
                className="w-16"
                aria-label="TTL restante"
              />
              <Chip size="sm" variant="flat" color={ttlColor}>
                {formatTTL(token.ttl_seconds)}
              </Chip>
            </div>
          );
        }
        case "actions":
          return (
            <div className="flex items-center gap-1 justify-center">
              <Tooltip content="Copiar Token ID">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => handleCopy(token.full_token_id)}
                >
                  <Copy size={16} className="text-default-500" />
                </Button>
              </Tooltip>
              {canManage && (
                <Tooltip content="Revocar token" color="danger">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => setRevokeTarget(token)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </Tooltip>
              )}
            </div>
          );
        default:
          return null;
      }
    },
    [canManage],
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gestion de Tokens
          </h1>
          <p className="text-default-500 mt-1">
            Genera y administra tokens de acceso para tus servicios.
          </p>
        </div>
        <div className="flex gap-2">
          <Tooltip content="Refrescar lista">
            <Button
              isIconOnly
              variant="flat"
              onPress={fetchTokens}
              isDisabled={loading}
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </Button>
          </Tooltip>
          {canManage && (
            <Button
              color="primary"
              startContent={<Plus size={18} />}
              onPress={openGenerateModal}
              className="font-semibold shadow-lg shadow-primary/20"
            >
              Generar Token
            </Button>
          )}
        </div>
      </div>

      {/* Alerta de token generado */}
      {generatedToken && (
        <Card className="bg-success/5 backdrop-blur-md border border-success/30 shadow-lg shadow-success/5 animate-appearance-in">
          <CardBody className="py-4">
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
                <Snippet
                  symbol=""
                  variant="flat"
                  color="success"
                  className="w-full"
                  onCopy={() => toast.success("Token copiado al portapapeles")}
                >
                  {generatedToken}
                </Snippet>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => setGeneratedToken(null)}
                className="text-success/50 hover:text-success shrink-0"
              >
                <X size={14} />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-content1/60 dark:bg-content1/40 backdrop-blur-lg border border-default-200/50 shadow-sm hover:shadow-md transition-shadow">
          <CardBody className="flex flex-row items-center gap-4 py-4">
            {loading ? (
              <Skeleton className="w-full h-12 rounded-lg" />
            ) : (
              <>
                <div className="p-2.5 bg-primary/10 rounded-xl ring-1 ring-primary/20 shadow-sm shadow-primary/10">
                  <KeyIcon size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-default-400 uppercase tracking-wider font-medium">
                    Tokens Activos
                  </p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </>
            )}
          </CardBody>
        </Card>
        <Card className="bg-content1/60 dark:bg-content1/40 backdrop-blur-lg border border-default-200/50 shadow-sm hover:shadow-md transition-shadow">
          <CardBody className="flex flex-row items-center gap-4 py-4">
            {loading ? (
              <Skeleton className="w-full h-12 rounded-lg" />
            ) : (
              <>
                <div className="p-2.5 bg-secondary/10 rounded-xl ring-1 ring-secondary/20 shadow-sm shadow-secondary/10">
                  <Server size={20} className="text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-default-400 uppercase tracking-wider font-medium">
                    Servicios
                  </p>
                  <p className="text-2xl font-bold">{stats.services}</p>
                </div>
              </>
            )}
          </CardBody>
        </Card>
        <Card className="bg-content1/60 dark:bg-content1/40 backdrop-blur-lg border border-default-200/50 shadow-sm hover:shadow-md transition-shadow">
          <CardBody className="flex flex-row items-center gap-4 py-4">
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
                  <p className="text-xs text-default-400 uppercase tracking-wider font-medium">
                    Expiran en &lt;24h
                  </p>
                  <p className="text-2xl font-bold">{stats.expiringSoon}</p>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Tabla de tokens */}
      <Card className="bg-content1/60 dark:bg-content1/40 backdrop-blur-lg border border-default-200/50 shadow-lg">
        <CardBody className="p-0">
          <div className="p-4 pb-2">
            <Input
              placeholder="Buscar por servicio o token ID..."
              startContent={
                <Search size={18} className="text-default-400 shrink-0" />
              }
              value={filterValue}
              onValueChange={(v) => {
                setFilterValue(v);
                setPage(1);
              }}
              variant="bordered"
              size="sm"
              className="max-w-md"
              isClearable
              onClear={() => setFilterValue("")}
            />
          </div>

          <Table
            aria-label="Tokens de servicio activos"
            isHeaderSticky
            isStriped
            classNames={{
              wrapper: "min-h-[320px]",
              th: "bg-default-100 text-default-600 text-xs uppercase tracking-wider",
            }}
            bottomContent={
              pages > 1 ? (
                <div className="flex justify-center py-2">
                  <Pagination
                    total={pages}
                    page={page}
                    onChange={setPage}
                    showControls
                    color="primary"
                    variant="flat"
                    size="sm"
                  />
                </div>
              ) : null
            }
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn
                  key={column.key}
                  align={column.key === "actions" ? "center" : "start"}
                >
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={loading ? [] : paginatedTokens}
              isLoading={loading}
              loadingContent={
                <div className="w-full space-y-3 p-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="w-full h-12 rounded-lg" />
                  ))}
                </div>
              }
              emptyContent={
                <div className="py-12 text-center">
                  <div className="inline-flex p-4 rounded-full bg-default-100 mb-4">
                    <Shield size={40} className="text-default-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-default-600 mb-1">
                    Sin tokens activos
                  </h3>
                  <p className="text-default-400 text-sm mb-4 max-w-sm mx-auto">
                    {filterValue
                      ? "No se encontraron tokens con ese filtro."
                      : "Aun no hay tokens generados. Crea uno para empezar."}
                  </p>
                  {canManage && !filterValue && (
                    <Button
                      color="primary"
                      variant="flat"
                      startContent={<Plus size={16} />}
                      onPress={openGenerateModal}
                      size="sm"
                    >
                      Generar primer token
                    </Button>
                  )}
                </div>
              }
            >
              {(item) => (
                <TableRow key={item.full_token_id}>
                  {(columnKey) => (
                    <TableCell>{renderCell(item, columnKey)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Tips de seguridad */}
      <Card className="bg-primary/5 backdrop-blur-md border border-primary/10">
        <CardBody className="p-5">
          <div className="flex gap-3">
            <Info className="text-primary shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-primary">
                Consejos de Seguridad
              </h4>
              <ul className="text-xs space-y-1 text-default-500 list-disc ml-4">
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
        </CardBody>
      </Card>

      {/* Modal generar token */}
      <Modal
        isOpen={generateOpen}
        onClose={() => setGenerateOpen(false)}
        size="2xl"
        backdrop="blur"
        scrollBehavior="inside"
        classNames={{
          backdrop: "bg-black/40 backdrop-blur-sm",
        }}
      >
        <ModalContent className="bg-content1/95 dark:bg-content1/90 backdrop-blur-xl border border-default-200/50 shadow-2xl">
          <ModalHeader className="flex items-center gap-3 border-b border-default-200/30 pb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <KeyIcon className="text-primary" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Generar Nuevo Token</h2>
              <p className="text-xs text-default-400 font-normal">
                Selecciona un servicio o completa los campos manualmente
              </p>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-5">
              <Autocomplete
                label="Seleccionar Servicio Registrado"
                placeholder="Busca un servicio..."
                isLoading={loadingServices}
                onSelectionChange={onServiceSelect}
                variant="bordered"
                popoverProps={{ placement: "bottom", triggerScaleOnOpen: false }}
              >
                {services.map((item: any) => (
                  <AutocompleteItem
                    key={item.service_id}
                    textValue={item.service_name}
                  >
                    <div className="flex justify-between items-center">
                      <span>{item.service_name}</span>
                      <Chip size="sm" variant="flat">
                        {item.service_id}
                      </Chip>
                    </div>
                  </AutocompleteItem>
                ))}
              </Autocomplete>

              <Divider />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Service ID"
                  variant="bordered"
                  value={form.service_id}
                  onValueChange={(v) => setForm({ ...form, service_id: v })}
                  isRequired
                  size="sm"
                />
                <Input
                  label="Service Name"
                  variant="bordered"
                  value={form.service_name}
                  onValueChange={(v) => setForm({ ...form, service_name: v })}
                  isRequired
                  size="sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Client ID"
                  variant="bordered"
                  value={form.client_id}
                  onValueChange={(v) => setForm({ ...form, client_id: v })}
                  isRequired
                  size="sm"
                />
                <Input
                  label="Client Secret"
                  type="password"
                  variant="bordered"
                  value={form.client_secret}
                  onValueChange={(v) =>
                    setForm({ ...form, client_secret: v })
                  }
                  isRequired
                  size="sm"
                  description="Ingresa manualmente el secreto del cliente"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Scopes (Permisos)"
                  selectionMode="multiple"
                  variant="bordered"
                  selectedKeys={form.scopes}
                  onSelectionChange={(keys) =>
                    setForm({ ...form, scopes: keys as Set<string> })
                  }
                  size="sm"
                  popoverProps={{ placement: "bottom", triggerScaleOnOpen: false }}
                >
                  {SCOPE_OPTIONS.map((s) => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="Expiracion (dias)"
                  type="number"
                  variant="bordered"
                  value={form.expiration_days}
                  onValueChange={(v) =>
                    setForm({ ...form, expiration_days: v })
                  }
                  min={1}
                  max={365}
                  size="sm"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="border-t border-default-200/30 pt-4">
            <Button
              variant="flat"
              onPress={() => setGenerateOpen(false)}
              isDisabled={generating}
            >
              Cancelar
            </Button>
            <Button
              color="primary"
              isLoading={generating}
              onPress={handleGenerate}
              className="font-semibold shadow-lg shadow-primary/20"
            >
              Generar Token de Acceso
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
