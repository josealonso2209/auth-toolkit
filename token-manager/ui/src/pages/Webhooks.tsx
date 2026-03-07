import { useEffect, useState } from "react";
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
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
  useDisclosure,
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
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [form, setForm] = useState({ name: "", url: "", secret: "", events: new Set<string>() });
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

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.createWebhook({ ...form, events: Array.from(form.events) });
      toast.success(`Webhook "${form.name}" creado`);
      onClose();
      setForm({ name: "", url: "", secret: "", events: new Set() });
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
        <Button color="primary" startContent={<Plus size={18} />} onPress={onOpen}>
          Nuevo webhook
        </Button>
      </div>

      <Table aria-label="Webhooks">
        <TableHeader>
          <TableColumn>Nombre</TableColumn>
          <TableColumn>URL</TableColumn>
          <TableColumn>Eventos</TableColumn>
          <TableColumn>Estado</TableColumn>
          <TableColumn>Acciones</TableColumn>
        </TableHeader>
        <TableBody
          items={webhooks}
          isLoading={loading}
          loadingContent={
            <div className="w-full space-y-3 p-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="w-full h-10 rounded-lg" />
              ))}
            </div>
          }
          emptyContent="Sin webhooks"
        >
          {(wh) => (
            <TableRow key={wh.id}>
              <TableCell className="font-medium">{wh.name}</TableCell>
              <TableCell className="text-sm text-default-400 max-w-xs truncate">{wh.url}</TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {wh.events.map((e) => (
                    <Chip key={e} size="sm" variant="flat">{e}</Chip>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Tooltip content={wh.is_active ? "Clic para desactivar" : "Clic para activar"}>
                  <Chip
                    size="sm"
                    color={wh.is_active ? "success" : "default"}
                    variant="dot"
                    className="cursor-pointer"
                    onClick={() => handleToggle(wh)}
                  >
                    {wh.is_active ? "Activo" : "Inactivo"}
                  </Chip>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Tooltip content="Eliminar webhook" color="danger">
                  <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => setDeleteTarget(wh)}>
                    <Trash2 size={16} />
                  </Button>
                </Tooltip>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Modal crear webhook */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader>Nuevo Webhook</ModalHeader>
          <ModalBody className="space-y-4">
            <Input label="Nombre" value={form.name} onValueChange={(v) => setForm({ ...form, name: v })} />
            <Input label="URL" value={form.url} onValueChange={(v) => setForm({ ...form, url: v })} placeholder="https://..." />
            <Input label="Secret (HMAC)" value={form.secret} onValueChange={(v) => setForm({ ...form, secret: v })} description="Opcional. Para firmar payloads." />
            <Select
              label="Eventos"
              selectionMode="multiple"
              selectedKeys={form.events}
              onSelectionChange={(keys) => setForm({ ...form, events: keys as Set<string> })}
            >
              {EVENTS.map((e) => <SelectItem key={e}>{e}</SelectItem>)}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose} isDisabled={creating}>Cancelar</Button>
            <Button color="primary" onPress={handleCreate} isLoading={creating}>Crear</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal confirmar eliminacion */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar webhook"
        message={`¿Estas seguro de eliminar el webhook "${deleteTarget?.name}"? Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmColor="danger"
        loading={deleting}
      />
    </div>
  );
}
