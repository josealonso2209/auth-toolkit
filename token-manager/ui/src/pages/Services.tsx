import { useState, useEffect } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Tooltip,
} from "@heroui/react";
import { Server, Trash2, Plus } from "lucide-react";
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
    allowed_scopes: new Set<string>(["read", "write"]),
    rate_limit: "0",
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      await api.registerService({
        ...form,
        allowed_scopes: Array.from(form.allowed_scopes),
        rate_limit: parseInt(form.rate_limit),
      });
      toast.success('Servicio registrado exitosamente');
      setForm({
        service_id: "",
        service_name: "",
        client_id: "",
        client_secret: "",
        description: "",
        allowed_scopes: new Set(["read", "write"]),
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Servicios</h1>
          <p className="text-default-500">Administra los servicios y aplicaciones que interactúan con el Auth Service.</p>
        </div>
        <Button 
          color="primary" 
          startContent={<Plus size={18} />}
          onPress={() => setShowForm(!showForm)}
          className="font-semibold shadow-lg shadow-primary/20"
        >
          {showForm ? "Cerrar Formulario" : "Nuevo Servicio"}
        </Button>
      </div>

      {showForm && (
        <Card className="max-w-3xl border-none shadow-md">
          <CardHeader className="flex gap-2 px-6 pt-6">
            <Server size={20} className="text-primary" />
            <h2 className="text-xl font-bold">Registrar Nuevo Servicio</h2>
          </CardHeader>
          <CardBody className="p-6">
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Service ID"
                  placeholder="ej. mi-microservicio"
                  variant="bordered"
                  value={form.service_id}
                  onValueChange={(v) => setForm({ ...form, service_id: v })}
                  isRequired
                />
                <Input
                  label="Service Name"
                  placeholder="ej. Mi Microservicio"
                  variant="bordered"
                  value={form.service_name}
                  onValueChange={(v) => setForm({ ...form, service_name: v })}
                  isRequired
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Client ID"
                  variant="bordered"
                  value={form.client_id}
                  onValueChange={(v) => setForm({ ...form, client_id: v })}
                  isRequired
                />
                <Input
                  label="Client Secret"
                  type="password"
                  variant="bordered"
                  value={form.client_secret}
                  onValueChange={(v) => setForm({ ...form, client_secret: v })}
                  isRequired
                />
              </div>
              <Input
                label="Descripción"
                variant="bordered"
                value={form.description}
                onValueChange={(v) => setForm({ ...form, description: v })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Scopes permitidos"
                  selectionMode="multiple"
                  variant="bordered"
                  selectedKeys={form.allowed_scopes}
                  onSelectionChange={(keys) =>
                    setForm({ ...form, allowed_scopes: keys as Set<string> })
                  }
                >
                  {SCOPE_OPTIONS.map((s) => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="Rate Limit (req/min)"
                  type="number"
                  variant="bordered"
                  value={form.rate_limit}
                  onValueChange={(v) => setForm({ ...form, rate_limit: v })}
                  min={0}
                  description="0 = Sin límite"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="flat" onPress={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" color="primary" isLoading={registering} className="px-8">
                  Guardar Servicio
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card className="border-none shadow-sm overflow-hidden">
        <Table aria-label="Lista de servicios" removeWrapper shadow="none">
          <TableHeader>
            <TableColumn>SERVICIO</TableColumn>
            <TableColumn>CLIENT ID</TableColumn>
            <TableColumn>SCOPES</TableColumn>
            <TableColumn>RATE LIMIT</TableColumn>
            <TableColumn align="center">ACCIONES</TableColumn>
          </TableHeader>
          <TableBody loadingState={loading ? "loading" : "idle"} emptyContent="No hay servicios registrados.">
            {services.map((svc) => (
              <TableRow key={svc.service_id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-small">{svc.service_name}</span>
                    <span className="text-tiny text-default-400">{svc.service_id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-tiny bg-default-100 px-1 py-0.5 rounded">{svc.client_id}</code>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(svc.allowed_scopes || []).map((scope: string) => (
                      <Chip key={scope} size="sm" variant="flat" color="secondary" className="text-tiny h-5">
                        {scope}
                      </Chip>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {svc.rate_limit > 0 ? (
                    <Chip size="sm" variant="dot" color="primary">{svc.rate_limit} / min</Chip>
                  ) : (
                    <span className="text-tiny text-default-400">Sin límite</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center items-center gap-2">
                    <Tooltip content="Eliminar Servicio" color="danger">
                      <Button 
                        isIconOnly 
                        size="sm" 
                        variant="light" 
                        color="danger"
                        onPress={() => setDeleteId(svc.service_id)}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar Servicio"
        message={'¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer.'}
        confirmLabel="Eliminar"
        confirmColor="danger"
      />
    </div>
  );
}
