import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
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
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Credenciales invalidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="flex flex-col items-center gap-2 pt-8 pb-0">
          <div className="p-4 rounded-full bg-primary/10">
            <Key className="text-primary" size={32} />
          </div>
          <h1 className="text-2xl font-bold">Auth Toolkit</h1>
          <p className="text-default-500 text-sm">Token Manager</p>
        </CardHeader>
        <CardBody className="px-8 pb-8 pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuario"
              value={username}
              onValueChange={setUsername}
              autoFocus
              size="lg"
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onValueChange={setPassword}
              size="lg"
            />
            {error && (
              <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800">
                <p className="text-danger text-sm text-center">{error}</p>
              </div>
            )}
            <Button
              type="submit"
              color="primary"
              className="w-full"
              size="lg"
              isLoading={loading}
              startContent={!loading ? <LogIn size={18} /> : undefined}
            >
              Iniciar sesion
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
