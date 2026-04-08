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
import { UserPlus, Trash2 } from "lucide-react";
import type { User } from "@/types";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";

const ROLES = [
  { key: "admin", label: "Admin" },
  { key: "operator", label: "Operator" },
  { key: "viewer", label: "Viewer" },
];

const roleColor: Record<string, "accent" | "default"> = {
  admin: "accent",
  operator: "default",
  viewer: "default",
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const modalState = useOverlayState({});
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
      modalState.close();
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
        <Button variant="primary" onPress={modalState.open}>
          <UserPlus size={18} />
          Nuevo usuario
        </Button>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Usuarios">
            <Table.Header>
              <Table.Column isRowHeader>Usuario</Table.Column>
              <Table.Column>Email</Table.Column>
              <Table.Column>Rol</Table.Column>
              <Table.Column>Estado</Table.Column>
              <Table.Column>Creado</Table.Column>
              <Table.Column>Acciones</Table.Column>
            </Table.Header>
            <Table.Body
              items={users}
              renderEmptyState={() => (
                loading ? (
                  <div className="w-full space-y-3 p-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="w-full h-10 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted">Sin usuarios</p>
                )
              )}
            >
              {(user: User) => (
                <Table.Row key={user.id} id={String(user.id)}>
                  <Table.Cell className="font-medium">{user.username}</Table.Cell>
                  <Table.Cell>{user.email}</Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" color={roleColor[user.role] || "default"} variant="soft">
                      {user.role}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className="cursor-pointer"
                        >
                          <Chip
                            size="sm"
                            color={user.is_active ? "success" : "default"}
                            variant="soft"
                          >
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${user.is_active ? "bg-success" : "bg-default"}`} />
                            {user.is_active ? "Activo" : "Inactivo"}
                          </Chip>
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>{user.is_active ? "Clic para desactivar" : "Clic para activar"}</Tooltip.Content>
                    </Tooltip>
                  </Table.Cell>
                  <Table.Cell className="text-muted text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </Table.Cell>
                  <Table.Cell>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          className="text-danger"
                          onPress={() => setDeleteTarget(user)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Eliminar usuario</Tooltip.Content>
                    </Tooltip>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {/* Modal crear usuario */}
      {modalState.isOpen && (
        <Modal>
          <Modal.Backdrop isOpen={modalState.isOpen} onOpenChange={(open) => !open && modalState.close()}>
            <Modal.Container>
              <Modal.Dialog>
                <Modal.Header>
                  <Modal.Heading>Nuevo usuario</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                  <TextField>
                    <Label>Usuario</Label>
                    <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                  </TextField>
                  <TextField type="email">
                    <Label>Email</Label>
                    <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </TextField>
                  <TextField type="password">
                    <Label>Contrasena</Label>
                    <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </TextField>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Rol</label>
                    <div className="flex gap-2">
                      {ROLES.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => setForm({ ...form, role: r.key })}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            form.role === r.key
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-surface border-border text-muted hover:border-accent/50"
                          }`}
                        >
                          {r.label}
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
        title="Eliminar usuario"
        message={`Estas seguro de eliminar al usuario "${deleteTarget?.username}"? Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmColor="danger"
        loading={deleting}
      />
    </div>
  );
}
