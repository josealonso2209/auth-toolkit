import { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
import { Server } from "lucide-react";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";

const SCOPE_OPTIONS = [
  { key: "read", label: "read" },
  { key: "write", label: "write" },
  { key: "admin", label: "admin" },
  { key: "delete", label: "delete" },
];

export default function Services() {
  const [form, setForm] = useState({
    service_id: "",
    service_name: "",
    client_id: "",
    client_secret: "",
    description: "",
    allowed_scopes: new Set<string>(["read", "write"]),
    rate_limit: "0",
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.registerService({
        ...form,
        allowed_scopes: Array.from(form.allowed_scopes),
        rate_limit: parseInt(form.rate_limit),
      });
      toast.success(`Servicio "${form.service_id}" registrado exitosamente`);
      setForm({
        service_id: "",
        service_name: "",
        client_id: "",
        client_secret: "",
        description: "",
        allowed_scopes: new Set(["read", "write"]),
        rate_limit: "0",
      });
    } catch (err: any) {
      toast.error(err.message || "Error al registrar servicio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Servicios</h1>

      <Card className="max-w-2xl">
        <CardHeader className="flex gap-2">
          <Server size={20} />
          <h2 className="text-lg font-semibold">Registrar Servicio</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Service ID"
                value={form.service_id}
                onValueChange={(v) => setForm({ ...form, service_id: v })}
                isRequired
              />
              <Input
                label="Service Name"
                value={form.service_name}
                onValueChange={(v) => setForm({ ...form, service_name: v })}
                isRequired
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Client ID"
                value={form.client_id}
                onValueChange={(v) => setForm({ ...form, client_id: v })}
                isRequired
              />
              <Input
                label="Client Secret"
                type="password"
                value={form.client_secret}
                onValueChange={(v) => setForm({ ...form, client_secret: v })}
                isRequired
              />
            </div>
            <Input
              label="Descripcion"
              value={form.description}
              onValueChange={(v) => setForm({ ...form, description: v })}
            />
            <Select
              label="Scopes permitidos"
              selectionMode="multiple"
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
              label="Rate Limit (validaciones/min, 0 = sin limite)"
              type="number"
              value={form.rate_limit}
              onValueChange={(v) => setForm({ ...form, rate_limit: v })}
              min={0}
            />
            <Button type="submit" color="primary" isLoading={loading} className="w-full">
              Registrar Servicio
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
