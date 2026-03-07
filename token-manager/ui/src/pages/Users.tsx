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
import { UserPlus, Trash2, ShieldCheck, ShieldOff } from "lucide-react";
import type { User } from "@/types";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";

const ROLES = [
  { key: "admin", label: "Admin" },
  { key: "operator", label: "Operator" },
  { key: "viewer", label: "Viewer" },
];

const roleColor: Record<string, "primary" | "secondary" | "default"> = {
  admin: "primary",
  operator: "secondary",
  viewer: "default",
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "viewer" });
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setUsers(await api.listUsers());
    } catch {
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.createUser(form);
      toast.success(`Usuario "${form.username}" creado`);
      onClose();
      setForm({ username: "", email: "", password: "", role: "viewer" });
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al crear usuario");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteUser(deleteTarget.id);
      toast.success(`Usuario "${deleteTarget.username}" eliminado`);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar usuario");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      toast.success(`Usuario "${user.username}" ${user.is_active ? "desactivado" : "activado"}`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar usuario");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Button color="primary" startContent={<UserPlus size={18} />} onPress={onOpen}>
          Nuevo usuario
        </Button>
      </div>

      <Table aria-label="Usuarios">
        <TableHeader>
          <TableColumn>Usuario</TableColumn>
          <TableColumn>Email</TableColumn>
          <TableColumn>Rol</TableColumn>
          <TableColumn>Estado</TableColumn>
          <TableColumn>Creado</TableColumn>
          <TableColumn>Acciones</TableColumn>
        </TableHeader>
        <TableBody
          items={users}
          isLoading={loading}
          loadingContent={
            <div className="w-full space-y-3 p-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="w-full h-10 rounded-lg" />
              ))}
            </div>
          }
          emptyContent="Sin usuarios"
        >
          {(user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.username}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Chip size="sm" color={roleColor[user.role] || "default"} variant="flat">
                  {user.role}
                </Chip>
              </TableCell>
              <TableCell>
                <Tooltip content={user.is_active ? "Clic para desactivar" : "Clic para activar"}>
                  <Chip
                    size="sm"
                    color={user.is_active ? "success" : "default"}
                    variant="dot"
                    className="cursor-pointer"
                    onClick={() => handleToggleActive(user)}
                  >
                    {user.is_active ? "Activo" : "Inactivo"}
                  </Chip>
                </Tooltip>
              </TableCell>
              <TableCell className="text-default-400 text-sm">
                {new Date(user.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Tooltip content="Eliminar usuario" color="danger">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => setDeleteTarget(user)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </Tooltip>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Modal crear usuario */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Nuevo usuario</ModalHeader>
          <ModalBody className="space-y-4">
            <Input label="Usuario" value={form.username} onValueChange={(v) => setForm({ ...form, username: v })} />
            <Input label="Email" type="email" value={form.email} onValueChange={(v) => setForm({ ...form, email: v })} />
            <Input label="Contraseña" type="password" value={form.password} onValueChange={(v) => setForm({ ...form, password: v })} />
            <Select label="Rol" selectedKeys={[form.role]} onSelectionChange={(keys) => setForm({ ...form, role: Array.from(keys)[0] as string })}>
              {ROLES.map((r) => <SelectItem key={r.key}>{r.label}</SelectItem>)}
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
        title="Eliminar usuario"
        message={`¿Estas seguro de eliminar al usuario "${deleteTarget?.username}"? Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmColor="danger"
        loading={deleting}
      />
    </div>
  );
}
