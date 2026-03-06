import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
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
import { UserPlus, Trash2 } from "lucide-react";
import type { User } from "@/types";
import * as api from "@/api/client";

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
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setError("");
    try {
      await api.createUser(form);
      onClose();
      setForm({ username: "", email: "", password: "", role: "viewer" });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar este usuario?")) return;
    try {
      await api.deleteUser(id);
      load();
    } catch {}
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      load();
    } catch {}
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
        <TableBody items={users} isLoading={loading} emptyContent="Sin usuarios">
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
                <Chip
                  size="sm"
                  color={user.is_active ? "success" : "default"}
                  variant="dot"
                  className="cursor-pointer"
                  onClick={() => handleToggleActive(user)}
                >
                  {user.is_active ? "Activo" : "Inactivo"}
                </Chip>
              </TableCell>
              <TableCell className="text-default-400 text-sm">
                {new Date(user.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => handleDelete(user.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Nuevo usuario</ModalHeader>
          <ModalBody className="space-y-4">
            {error && <p className="text-danger text-sm">{error}</p>}
            <Input label="Usuario" value={form.username} onValueChange={(v) => setForm({ ...form, username: v })} />
            <Input label="Email" type="email" value={form.email} onValueChange={(v) => setForm({ ...form, email: v })} />
            <Input label="Contraseña" type="password" value={form.password} onValueChange={(v) => setForm({ ...form, password: v })} />
            <Select label="Rol" selectedKeys={[form.role]} onSelectionChange={(keys) => setForm({ ...form, role: Array.from(keys)[0] as string })}>
              {ROLES.map((r) => <SelectItem key={r.key}>{r.label}</SelectItem>)}
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
