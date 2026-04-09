import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Chip,
  TextField,
  Label,
  Input,
  Modal,
  Skeleton,
  Table,
  Tooltip,
  useOverlayState,
} from "@heroui/react";
import {
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Pencil,
} from "lucide-react";
import type { Webhook } from "@/types";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";

type Delivery = {
  id: number;
  webhook_id: number;
  event: string;
  payload: any;
  response_status: number | null;
  success: boolean;
  attempt: number;
  delivered_at: string;
  duration_ms: number | null;
};

const EVENT_GROUPS: Record<string, string[]> = {
  Token: [
    "token.generated",
    "token.revoked",
    "token.revoked_all",
    "token.expired",
    "token.expiring_soon",
  ],
  Service: [
    "service.registered",
    "service.deleted",
    "service.bulk_registered",
    "service.locked",
    "service.unlocked",
  ],
  Partner: [
    "partner.key.created",
    "partner.key.deleted",
  ],
};

const ALL_EVENTS = Object.values(EVENT_GROUPS).flat();

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const modalState = useOverlayState({});
  const [form, setForm] = useState({ name: "", url: "", secret: "", events: [] as string[] });
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Editar webhook
  const [editTarget, setEditTarget] = useState<Webhook | null>(null);
  const [editForm, setEditForm] = useState({ name: "", url: "", secret: "", events: [] as string[] });
  const [saving, setSaving] = useState(false);

  // Detalle + deliveries
  const [detailWebhook, setDetailWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const load = async () => {
    try {
      setWebhooks(await api.listWebhooks());
    } catch {
      toast.error("Error al cargar webhooks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error("El nombre es obligatorio");
    if (!form.url.trim()) return toast.error("La URL es obligatoria");
    if (form.events.length === 0) return toast.error("Selecciona al menos un evento");
    setCreating(true);
    try {
      await api.createWebhook({ ...form, events: form.events });
      toast.success(`Webhook "${form.name}" creado`);
      modalState.close();
      setForm({ name: "", url: "", secret: "", events: [] });
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al crear webhook");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (wh: Webhook) => {
    setEditTarget(wh);
    setEditForm({ name: wh.name, url: wh.url, secret: "", events: [...wh.events] });
  };

  const toggleEditEvent = (event: string) => {
    setEditForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) return toast.error("El nombre es obligatorio");
    if (!editForm.url.trim()) return toast.error("La URL es obligatoria");
    if (editForm.events.length === 0) return toast.error("Selecciona al menos un evento");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name,
        url: editForm.url,
        events: editForm.events,
      };
      if (editForm.secret) payload.secret = editForm.secret;
      await api.updateWebhook(editTarget.id, payload);
      toast.success(`Webhook "${editForm.name}" actualizado`);
      setEditTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteWebhook(deleteTarget.id);
      toast.success(`Webhook "${deleteTarget.name}" eliminado`);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar webhook");
    } finally {
      setDeleting(false);
    }
  };

  const openDetail = async (wh: Webhook) => {
    setDetailWebhook(wh);
    setDeliveries([]);
    setLoadingDeliveries(true);
    try {
      const data = await api.listDeliveries(wh.id);
      setDeliveries(data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar deliveries");
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const refreshDeliveries = async () => {
    if (!detailWebhook) return;
    setLoadingDeliveries(true);
    try {
      const data = await api.listDeliveries(detailWebhook.id);
      setDeliveries(data || []);
    } catch {
      /* silenciar */
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const handleRetry = async (delivery: Delivery) => {
    if (!detailWebhook) return;
    setRetryingId(delivery.id);
    try {
      const result = await api.retryDelivery(detailWebhook.id, delivery.id);
      if (result.success) {
        toast.success(`Reintento exitoso (HTTP ${result.response_status})`);
      } else {
        toast.error(`Reintento fallo (HTTP ${result.response_status ?? "??"})`);
      }
      await refreshDeliveries();
    } catch (err: any) {
      toast.error(err.message || "Error al reintentar");
    } finally {
      setRetryingId(null);
    }
  };

  const handleToggle = async (wh: Webhook) => {
    try {
      await api.updateWebhook(wh.id, { is_active: !wh.is_active });
      toast.success(`Webhook "${wh.name}" ${wh.is_active ? "desactivado" : "activado"}`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar webhook");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <Button variant="primary" onPress={modalState.open}>
          <Plus size={18} />
          Nuevo webhook
        </Button>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Webhooks">
            <Table.Header>
              <Table.Column isRowHeader>Nombre</Table.Column>
              <Table.Column>URL</Table.Column>
              <Table.Column>Eventos</Table.Column>
              <Table.Column>Estado</Table.Column>
              <Table.Column>Acciones</Table.Column>
            </Table.Header>
            <Table.Body
              items={webhooks}
              renderEmptyState={() => (
                loading ? (
                  <div className="w-full space-y-3 p-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="w-full h-10 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted">Sin webhooks</p>
                )
              )}
            >
              {(wh: Webhook) => (
                <Table.Row key={wh.id} id={String(wh.id)}>
                  <Table.Cell className="font-medium">{wh.name}</Table.Cell>
                  <Table.Cell className="text-sm text-muted max-w-xs truncate">{wh.url}</Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1 flex-wrap">
                      {wh.events.map((e) => (
                        <Chip key={e} size="sm" variant="soft">{e}</Chip>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <button onClick={() => handleToggle(wh)} className="cursor-pointer">
                          <Chip
                            size="sm"
                            color={wh.is_active ? "success" : "default"}
                            variant="soft"
                          >
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${wh.is_active ? "bg-success" : "bg-default"}`} />
                            {wh.is_active ? "Activo" : "Inactivo"}
                          </Chip>
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>{wh.is_active ? "Clic para desactivar" : "Clic para activar"}</Tooltip.Content>
                    </Tooltip>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <Tooltip.Trigger>
                          <Button isIconOnly size="sm" variant="ghost" onPress={() => openDetail(wh)}>
                            <Eye size={16} className="text-muted" />
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Ver detalle y entregas</Tooltip.Content>
                      </Tooltip>
                      <Tooltip>
                        <Tooltip.Trigger>
                          <Button isIconOnly size="sm" variant="ghost" onPress={() => openEdit(wh)}>
                            <Pencil size={16} className="text-muted" />
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Editar webhook</Tooltip.Content>
                      </Tooltip>
                      <Tooltip>
                        <Tooltip.Trigger>
                          <Button isIconOnly size="sm" variant="ghost" className="text-danger" onPress={() => setDeleteTarget(wh)}>
                            <Trash2 size={16} />
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Eliminar webhook</Tooltip.Content>
                      </Tooltip>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {/* Modal crear webhook */}
      {modalState.isOpen && (
        <Modal>
          <Modal.Backdrop isOpen={modalState.isOpen} onOpenChange={(open) => !open && modalState.close()}>
            <Modal.Container size="lg">
              <Modal.Dialog>
                <Modal.Header>
                  <Modal.Heading>Nuevo Webhook</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                  <TextField>
                    <Label>Nombre</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </TextField>
                  <TextField>
                    <Label>URL</Label>
                    <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
                  </TextField>
                  <TextField>
                    <Label>Secret (HMAC)</Label>
                    <Input value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
                  </TextField>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Eventos</label>
                    <div className="space-y-3">
                      {Object.entries(EVENT_GROUPS).map(([group, events]) => (
                        <div key={group}>
                          <p className="text-xs text-muted mb-1.5">{group}</p>
                          <div className="flex flex-wrap gap-2">
                            {events.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => toggleEvent(e)}
                                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                                  form.events.includes(e)
                                    ? "bg-accent text-accent-foreground border-accent"
                                    : "bg-surface border-border text-muted hover:border-accent/50"
                                }`}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={modalState.close} isDisabled={creating}>Cancelar</Button>
                  <Button variant="primary" onPress={handleCreate} isPending={creating}>Crear</Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}

      {/* Modal editar webhook */}
      {editTarget && (
        <Modal>
          <Modal.Backdrop isOpen={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
            <Modal.Container size="lg">
              <Modal.Dialog>
                <Modal.Header>
                  <Modal.Heading>Editar Webhook</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                  <TextField>
                    <Label>Nombre</Label>
                    <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </TextField>
                  <TextField>
                    <Label>URL</Label>
                    <Input value={editForm.url} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })} placeholder="https://..." />
                  </TextField>
                  <TextField>
                    <Label>Secret (dejar vacio para mantener el actual)</Label>
                    <Input value={editForm.secret} onChange={(e) => setEditForm({ ...editForm, secret: e.target.value })} placeholder="Sin cambios" />
                  </TextField>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Eventos</label>
                    <div className="space-y-3">
                      {Object.entries(EVENT_GROUPS).map(([group, events]) => (
                        <div key={group}>
                          <p className="text-xs text-muted mb-1.5">{group}</p>
                          <div className="flex flex-wrap gap-2">
                            {events.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => toggleEditEvent(e)}
                                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                                  editForm.events.includes(e)
                                    ? "bg-accent text-accent-foreground border-accent"
                                    : "bg-surface border-border text-muted hover:border-accent/50"
                                }`}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={() => setEditTarget(null)} isDisabled={saving}>Cancelar</Button>
                  <Button variant="primary" onPress={handleSaveEdit} isPending={saving}>Guardar</Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}

      {/* Modal detalle webhook + deliveries */}
      {detailWebhook && (
        <Modal>
          <Modal.Backdrop
            isOpen={!!detailWebhook}
            onOpenChange={(open) => !open && setDetailWebhook(null)}
            variant="blur"
          >
            <Modal.Container size="lg">
              <Modal.Dialog>
                <Modal.Header className="border-b border-border pb-4">
                  <div className="flex items-start justify-between gap-3 w-full">
                    <div className="min-w-0">
                      <Modal.Heading className="text-lg font-bold flex items-center gap-2">
                        <Send size={18} className="text-accent" />
                        {detailWebhook.name}
                      </Modal.Heading>
                      <p className="text-xs text-muted font-normal mt-0.5 truncate font-mono">
                        {detailWebhook.url}
                      </p>
                    </div>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="secondary"
                          onPress={refreshDeliveries}
                          isDisabled={loadingDeliveries}
                        >
                          <RefreshCw
                            size={16}
                            className={loadingDeliveries ? "animate-spin" : ""}
                          />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Refrescar entregas</Tooltip.Content>
                    </Tooltip>
                  </div>
                </Modal.Header>
                <Modal.Body className="space-y-5">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="bg-default/5 border border-border">
                      <Card.Content className="p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted">
                          Total entregas
                        </p>
                        <p className="text-xl font-bold">{deliveries.length}</p>
                      </Card.Content>
                    </Card>
                    <Card className="bg-success/5 border border-success/20">
                      <Card.Content className="p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted">
                          Exitosas
                        </p>
                        <p className="text-xl font-bold text-success">
                          {deliveries.filter((d) => d.success).length}
                        </p>
                      </Card.Content>
                    </Card>
                    <Card className="bg-danger/5 border border-danger/20">
                      <Card.Content className="p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted">
                          Fallidas
                        </p>
                        <p className="text-xl font-bold text-danger">
                          {deliveries.filter((d) => !d.success).length}
                        </p>
                      </Card.Content>
                    </Card>
                  </div>

                  {/* Eventos suscritos */}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted mb-2">
                      Eventos suscritos
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {detailWebhook.events.map((e) => (
                        <Chip key={e} size="sm" variant="soft">
                          {e}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  {/* Lista de deliveries */}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted mb-2">
                      Ultimas entregas (max 20)
                    </p>
                    {loadingDeliveries && (
                      <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="w-full h-14 rounded-lg" />
                        ))}
                      </div>
                    )}
                    {!loadingDeliveries && deliveries.length === 0 && (
                      <p className="text-sm text-muted text-center py-6">
                        Sin entregas registradas todavia.
                      </p>
                    )}
                    {!loadingDeliveries && deliveries.length > 0 && (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {deliveries.map((d) => (
                          <div
                            key={d.id}
                            className={`p-3 rounded-lg border ${
                              d.success
                                ? "bg-success/5 border-success/20"
                                : "bg-danger/5 border-danger/20"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                {d.success ? (
                                  <CheckCircle2
                                    size={18}
                                    className="text-success shrink-0 mt-0.5"
                                  />
                                ) : (
                                  <XCircle
                                    size={18}
                                    className="text-danger shrink-0 mt-0.5"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Chip size="sm" variant="soft">
                                      {d.event}
                                    </Chip>
                                    <Chip
                                      size="sm"
                                      variant="soft"
                                      color={d.success ? "success" : "danger"}
                                    >
                                      HTTP {d.response_status ?? "—"}
                                    </Chip>
                                    <Chip size="sm" variant="soft">
                                      intento #{d.attempt}
                                    </Chip>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-muted mt-1">
                                    <span className="flex items-center gap-1">
                                      <Clock size={11} />
                                      {new Date(d.delivered_at).toLocaleString("es-ES")}
                                    </span>
                                    {d.duration_ms !== null && (
                                      <span>{d.duration_ms} ms</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Tooltip>
                                <Tooltip.Trigger>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onPress={() => handleRetry(d)}
                                    isPending={retryingId === d.id}
                                  >
                                    <RefreshCw size={14} />
                                    Reintentar
                                  </Button>
                                </Tooltip.Trigger>
                                <Tooltip.Content>
                                  Reenviar este evento al webhook
                                </Tooltip.Content>
                              </Tooltip>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Modal.Body>
                <Modal.Footer className="border-t border-border pt-4">
                  <Button variant="secondary" onPress={() => setDetailWebhook(null)}>
                    Cerrar
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}

      {/* Modal confirmar eliminacion */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar webhook"
        message={`Estas seguro de eliminar el webhook "${deleteTarget?.name}"? Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmColor="danger"
        loading={deleting}
      />
    </div>
  );
}
