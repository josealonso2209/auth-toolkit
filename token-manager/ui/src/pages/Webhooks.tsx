import { useEffect, useState } from "react";
import {
  Button,
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
import { Plus, Trash2 } from "lucide-react";
import type { Webhook } from "@/types";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";

const EVENTS = [
  "token.generated",
  "token.revoked",
  "token.expired",
  "token.expiring_soon",
  "service.registered",
  "service.deleted",
];

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const modalState = useOverlayState({});
  const [form, setForm] = useState({ name: "", url: "", secret: "", events: [] as string[] });
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);
  const [deleting, setDeleting] = useState(false);

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
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button isIconOnly size="sm" variant="ghost" className="text-danger" onPress={() => setDeleteTarget(wh)}>
                          <Trash2 size={16} />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Eliminar webhook</Tooltip.Content>
                    </Tooltip>
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
                    <div className="flex flex-wrap gap-2">
                      {EVENTS.map((e) => (
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
