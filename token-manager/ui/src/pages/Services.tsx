import { useState, useEffect } from "react";
import {
  Button,
  Card,
  TextField,
  Label,
  Input,
  Table,
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
    allowed_scopes: ["read", "write"] as string[],
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
                <Table.Column className="text-center">ACCIONES</Table.Column>
              </Table.Header>
              <Table.Body
                items={services}
                renderEmptyState={() => (
                  <p className="text-center py-8 text-muted">No hay servicios registrados.</p>
                )}
              >
                {(svc: any) => (
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
                      <div className="flex justify-center items-center gap-2">
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
                )}
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
    </div>
  );
}
