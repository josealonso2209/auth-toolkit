import { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Snippet,
  Textarea,
} from "@heroui/react";
import { Key, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import * as api from "@/api/client";

const SCOPE_OPTIONS = [
  { key: "read", label: "read" },
  { key: "write", label: "write" },
  { key: "admin", label: "admin" },
  { key: "delete", label: "delete" },
];

export default function Tokens() {
  const { hasRole } = useAuthStore();
  const canGenerate = hasRole("admin", "operator");

  const [form, setForm] = useState({
    service_id: "",
    service_name: "",
    client_id: "",
    client_secret: "",
    scopes: new Set<string>(["read"]),
    expiration_days: "30",
  });
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setGeneratedToken(null);
    setLoading(true);
    try {
      const res = await api.generateToken({
        service_id: form.service_id,
        service_name: form.service_name,
        client_id: form.client_id,
        client_secret: form.client_secret,
        scopes: Array.from(form.scopes),
        expiration_days: parseInt(form.expiration_days),
      });
      setGeneratedToken(res.token);
      setSuccess(`Token generado (expira en ${form.expiration_days} dias)`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId.trim()) return;
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await api.revokeToken(revokeId.trim());
      setSuccess("Token revocado exitosamente");
      setRevokeId("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestion de Tokens</h1>

      {error && (
        <div className="p-3 rounded-lg bg-danger-50 text-danger text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-success-50 text-success text-sm">{success}</div>
      )}

      {generatedToken && (
        <Card className="border-success border">
          <CardBody>
            <p className="text-sm text-default-500 mb-2">Token generado (copialo ahora, no se mostrara de nuevo):</p>
            <Snippet symbol="" variant="bordered" className="w-full">
              {generatedToken}
            </Snippet>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canGenerate && (
          <Card>
            <CardHeader className="flex gap-2">
              <Key size={20} />
              <h2 className="text-lg font-semibold">Generar Token</h2>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleGenerate} className="space-y-4">
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
                <Select
                  label="Scopes"
                  selectionMode="multiple"
                  selectedKeys={form.scopes}
                  onSelectionChange={(keys) =>
                    setForm({ ...form, scopes: keys as Set<string> })
                  }
                >
                  {SCOPE_OPTIONS.map((s) => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="Expiracion (dias)"
                  type="number"
                  value={form.expiration_days}
                  onValueChange={(v) => setForm({ ...form, expiration_days: v })}
                  min={1}
                  max={365}
                />
                <Button type="submit" color="primary" isLoading={loading} className="w-full">
                  Generar Token
                </Button>
              </form>
            </CardBody>
          </Card>
        )}

        {canGenerate && (
          <Card>
            <CardHeader className="flex gap-2">
              <Trash2 size={20} />
              <h2 className="text-lg font-semibold">Revocar Token</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Textarea
                label="Token ID a revocar"
                value={revokeId}
                onValueChange={setRevokeId}
                placeholder="Pega el token completo aqui..."
                minRows={3}
              />
              <Button
                color="danger"
                onPress={handleRevoke}
                isLoading={loading}
                isDisabled={!revokeId.trim()}
                className="w-full"
              >
                Revocar Token
              </Button>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
