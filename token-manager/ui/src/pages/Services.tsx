import { useState, useEffect } from "react";
import {
  Button,
  Card,
  TextField,
  Label,
  Input,
  Modal,
  Table,
  Chip,
  Tooltip,
} from "@heroui/react";
import {
  Server,
  Trash2,
  Plus,
  Lock,
  Unlock,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";

const SCOPE_OPTIONS = [
  { key: "read", label: "read" },
  { key: "write", label: "write" },
  { key: "admin", label: "admin" },
  { key: "delete", label: "delete" },
];

export default function Services() {
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin");

  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    service_id: "",
    service_name: "",
    client_id: "",
    client_secret: "",
    description: "",
    allowed_scopes: ["read", "write"] as string[],
    rate_limit: "0",
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lockTarget, setLockTarget] = useState<any | null>(null);
  const [locking, setLocking] = useState(false);
  const [panicTarget, setPanicTarget] = useState<any | null>(null);
  const [panicConfirmInput, setPanicConfirmInput] = useState("");
  const [panicRunning, setPanicRunning] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const data = await api.listServices();
      setServices(data || []);
    } catch (err: any) {
      toast.error("No se pudieron cargar los servicios");
    } finally {
      setLoading(false);
    }
  };

  const toggleScope = (scope: string) => {
    setForm((prev) => ({
      ...prev,
      allowed_scopes: prev.allowed_scopes.includes(scope)
        ? prev.allowed_scopes.filter((s) => s !== scope)
        : [...prev.allowed_scopes, scope],
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      await api.registerService({
        ...form,
        allowed_scopes: form.allowed_scopes,
        rate_limit: parseInt(form.rate_limit),
      });
      toast.success('Servicio registrado exitosamente');
      setForm({
        service_id: "",
        service_name: "",
        client_id: "",
        client_secret: "",
        description: "",
        allowed_scopes: ["read", "write"],
        rate_limit: "0",
      });
      setShowForm(false);
      fetchServices();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar servicio");
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteService(deleteId);
      toast.success("Servicio eliminado");
      fetchServices();
    } catch (err: any) {
      toast.error("Error al eliminar servicio");
    } finally {
      setDeleteId(null);
    }
  };

  const openLockTarget = (svc: any) => setLockTarget(svc);

  const handleToggleLock = async () => {
    if (!lockTarget) return;
    setLocking(true);
    try {
      if (lockTarget.is_active === false) {
        await api.unlockService(lockTarget.service_id);
        toast.success(`Servicio "${lockTarget.service_name}" desbloqueado`);
      } else {
        await api.lockService(lockTarget.service_id);
        toast.success(`Servicio "${lockTarget.service_name}" bloqueado`);
      }
      fetchServices();
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado del servicio");
    } finally {
      setLocking(false);
      setLockTarget(null);
    }
  };

  const openPanic = (svc: any) => {
    setPanicTarget(svc);
    setPanicConfirmInput("");
  };

  const closePanic = () => {
    setPanicTarget(null);
    setPanicConfirmInput("");
  };

  const handlePanicRevoke = async () => {
    if (!panicTarget) return;
    setPanicRunning(true);
    try {
      const res = await api.revokeAllForService(panicTarget.service_id);
      toast.success(
        `Kill switch ejecutado: ${res.revoked_count} tokens revocados`,
      );
      fetchServices();
      closePanic();
    } catch (err: any) {
      toast.error(err.message || "Error al ejecutar kill switch");
    } finally {
      setPanicRunning(false);
    }
  };

  const panicConfirmed =
    panicTarget && panicConfirmInput.trim() === panicTarget.service_id;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Servicios</h1>
          <p className="text-muted">Administra los servicios y aplicaciones que interactuan con el Auth Service.</p>
        </div>
        <Button
          variant="primary"
          onPress={() => setShowForm(!showForm)}
          className="font-semibold shadow-lg shadow-accent/20"
        >
          <Plus size={18} />
          {showForm ? "Cerrar Formulario" : "Nuevo Servicio"}
        </Button>
      </div>

      {showForm && (
        <Card className="max-w-3xl shadow-md">
          <Card.Header className="flex gap-2 px-6 pt-6">
            <Server size={20} className="text-accent" />
            <h2 className="text-xl font-bold">Registrar Nuevo Servicio</h2>
          </Card.Header>
          <Card.Content className="p-6">
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField isRequired>
                  <Label>Service ID</Label>
                  <Input
                    placeholder="ej. mi-microservicio"
                    value={form.service_id}
                    onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                  />
                </TextField>
                <TextField isRequired>
                  <Label>Service Name</Label>
                  <Input
                    placeholder="ej. Mi Microservicio"
                    value={form.service_name}
                    onChange={(e) => setForm({ ...form, service_name: e.target.value })}
                  />
                </TextField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField isRequired>
                  <Label>Client ID</Label>
                  <Input
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  />
                </TextField>
                <TextField isRequired>
                  <Label>Client Secret</Label>
                  <Input
                    type="password"
                    value={form.client_secret}
                    onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                  />
                </TextField>
              </div>
              <TextField>
                <Label>Descripcion</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </TextField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Scopes permitidos</label>
                  <div className="flex flex-wrap gap-2">
                    {SCOPE_OPTIONS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => toggleScope(s.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          form.allowed_scopes.includes(s.key)
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
                  <Label>Rate Limit (req/min)</Label>
                  <Input
                    type="number"
                    value={form.rate_limit}
                    onChange={(e) => setForm({ ...form, rate_limit: e.target.value })}
                    min={0}
                  />
                </TextField>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onPress={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" isPending={registering} className="px-8">
                  Guardar Servicio
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>
      )}

      <Card className="shadow-sm overflow-hidden">
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Lista de servicios">
              <Table.Header>
                <Table.Column isRowHeader>SERVICIO</Table.Column>
                <Table.Column>CLIENT ID</Table.Column>
                <Table.Column>SCOPES</Table.Column>
                <Table.Column>RATE LIMIT</Table.Column>
                <Table.Column>ESTADO</Table.Column>
                <Table.Column className="text-center">ACCIONES</Table.Column>
              </Table.Header>
              <Table.Body
                items={services}
                renderEmptyState={() => (
                  <p className="text-center py-8 text-muted">No hay servicios registrados.</p>
                )}
              >
                {(svc: any) => {
                  const isLocked = svc.is_active === false;
                  return (
                  <Table.Row key={svc.service_id} id={svc.service_id}>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{svc.service_name}</span>
                        <span className="text-xs text-muted">{svc.service_id}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <code className="text-xs bg-default/10 px-1 py-0.5 rounded">{svc.client_id}</code>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">
                        {(svc.allowed_scopes || []).map((scope: string) => (
                          <Chip key={scope} size="sm" variant="soft" className="text-xs h-5">
                            {scope}
                          </Chip>
                        ))}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {svc.rate_limit > 0 ? (
                        <Chip size="sm" variant="secondary">{svc.rate_limit} / min</Chip>
                      ) : (
                        <span className="text-xs text-muted">Sin limite</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
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
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-center items-center gap-1">
                        {isAdmin && (
                          <Tooltip>
                            <Tooltip.Trigger>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                className={isLocked ? "text-warning" : "text-muted"}
                                onPress={() => openLockTarget(svc)}
                              >
                                {isLocked ? <Unlock size={17} /> : <Lock size={17} />}
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                              {isLocked ? "Desbloquear servicio" : "Bloquear servicio"}
                            </Tooltip.Content>
                          </Tooltip>
                        )}
                        {isAdmin && (
                          <Tooltip>
                            <Tooltip.Trigger>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                className="text-danger"
                                onPress={() => openPanic(svc)}
                              >
                                <ShieldAlert size={18} />
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                              Kill switch: revocar todos los tokens
                            </Tooltip.Content>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <Tooltip.Trigger>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              className="text-danger"
                              onPress={() => setDeleteId(svc.service_id)}
                            >
                              <Trash2 size={18} />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Content>Eliminar Servicio</Tooltip.Content>
                        </Tooltip>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                  );
                }}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar Servicio"
        message={'Estas seguro de que deseas eliminar este servicio? Esta accion no se puede deshacer.'}
        confirmLabel="Eliminar"
        confirmColor="danger"
      />

      <ConfirmModal
        isOpen={!!lockTarget}
        onClose={() => setLockTarget(null)}
        onConfirm={handleToggleLock}
        title={
          lockTarget?.is_active === false
            ? "Desbloquear servicio"
            : "Bloquear servicio"
        }
        message={
          lockTarget?.is_active === false
            ? `El servicio "${lockTarget?.service_name}" volvera a poder pedir tokens. Sus tokens previamente revocados NO se restauran.`
            : `El servicio "${lockTarget?.service_name}" no podra pedir nuevos tokens hasta que sea desbloqueado. Los tokens activos siguen siendo validos hasta que expiren o sean revocados.`
        }
        confirmLabel={lockTarget?.is_active === false ? "Desbloquear" : "Bloquear"}
        confirmColor={lockTarget?.is_active === false ? "primary" : "danger"}
        loading={locking}
      />

      {panicTarget && (
        <Modal>
          <Modal.Backdrop
            isOpen={!!panicTarget}
            onOpenChange={(open) => !open && closePanic()}
            variant="blur"
          >
            <Modal.Container size="md">
              <Modal.Dialog>
                <Modal.Header className="flex items-center gap-3 border-b border-danger/20 pb-4">
                  <div className="p-2 bg-danger/10 rounded-lg ring-1 ring-danger/30 animate-pulse">
                    <ShieldAlert className="text-danger" size={22} />
                  </div>
                  <div>
                    <Modal.Heading className="text-lg font-bold text-danger">
                      Kill switch — Revocar todos los tokens
                    </Modal.Heading>
                    <p className="text-xs text-muted font-normal">
                      Accion de emergencia, irreversible
                    </p>
                  </div>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                  <div className="flex gap-3 p-3 rounded-lg bg-danger/5 border border-danger/20">
                    <AlertTriangle
                      size={18}
                      className="text-danger shrink-0 mt-0.5"
                    />
                    <div className="text-sm space-y-1">
                      <p>
                        Esta accion <strong>revocara TODOS los tokens activos</strong> del
                        servicio{" "}
                        <code className="px-1 py-0.5 bg-default/20 rounded">
                          {panicTarget.service_name}
                        </code>
                        .
                      </p>
                      <p className="text-muted text-xs">
                        Todos los microservicios que usen estos tokens dejaran de
                        funcionar hasta generar tokens nuevos. Usa esto solo ante
                        un incidente de seguridad.
                      </p>
                    </div>
                  </div>

                  <TextField>
                    <Label className="text-sm">
                      Para confirmar, escribe el service_id:{" "}
                      <code className="px-1.5 py-0.5 bg-default/20 rounded font-mono text-xs">
                        {panicTarget.service_id}
                      </code>
                    </Label>
                    <Input
                      autoFocus
                      value={panicConfirmInput}
                      onChange={(e) => setPanicConfirmInput(e.target.value)}
                      placeholder={panicTarget.service_id}
                    />
                  </TextField>
                </Modal.Body>
                <Modal.Footer className="border-t border-border pt-4">
                  <Button
                    variant="secondary"
                    onPress={closePanic}
                    isDisabled={panicRunning}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    isPending={panicRunning}
                    isDisabled={!panicConfirmed}
                    onPress={handlePanicRevoke}
                    className="font-semibold"
                  >
                    Revocar todos los tokens
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </div>
  );
}
