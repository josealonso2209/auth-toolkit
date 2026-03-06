import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
} from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import type { Webhook } from "@/types";
import * as api from "@/api/client";

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
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setWebhooks(await api.listWebhooks());
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setError("");
    try {
      await api.createWebhook({ ...form, events: Array.from(form.events) });
      onClose();
      setForm({ name: "", url: "", secret: "", events: new Set() });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar este webhook?")) return;
    try {
      await api.deleteWebhook(id);
      load();
    } catch {}
  };

  const handleToggle = async (wh: Webhook) => {
    try {
      await api.updateWebhook(wh.id, { is_active: !wh.is_active });
      load();
    } catch {}
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
        <TableBody items={webhooks} isLoading={loading} emptyContent="Sin webhooks">
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
                <Chip
                  size="sm"
                  color={wh.is_active ? "success" : "default"}
                  variant="dot"
                  className="cursor-pointer"
                  onClick={() => handleToggle(wh)}
                >
                  {wh.is_active ? "Activo" : "Inactivo"}
                </Chip>
              </TableCell>
              <TableCell>
                <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => handleDelete(wh.id)}>
                  <Trash2 size={16} />
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader>Nuevo Webhook</ModalHeader>
          <ModalBody className="space-y-4">
            {error && <p className="text-danger text-sm">{error}</p>}
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
            <Button variant="flat" onPress={onClose}>Cancelar</Button>
            <Button color="primary" onPress={handleCreate}>Crear</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
