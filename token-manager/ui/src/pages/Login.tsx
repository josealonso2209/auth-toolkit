import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button, Card, TextField, Label, Input } from "@heroui/react";
import { Key, LogIn } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import * as api from "@/api/client";

export default function Login() {
  const { user, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(username, password);
      setAuth(res.user, res.session_id);
      navigate(res.user.role === "partner" ? "/api-keys" : "/");
    } catch (err: any) {
      setError(err.message || "Credenciales invalidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <Card.Header className="flex flex-col items-center gap-2 pt-8 pb-0">
          <div className="p-4 rounded-full bg-accent/10">
            <Key className="text-accent" size={32} />
          </div>
          <h1 className="text-2xl font-bold">Auth Toolkit</h1>
          <p className="text-muted text-sm">Token Manager</p>
        </Card.Header>
        <Card.Content className="px-8 pb-8 pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField>
              <Label>Usuario</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </TextField>
            <TextField type="password">
              <Label>Contrasena</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </TextField>
            {error && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30">
                <p className="text-danger text-sm text-center">{error}</p>
              </div>
            )}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isPending={loading}
            >
              <LogIn size={18} />
              Iniciar sesion
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
