import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { Key } from "lucide-react";
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-2 pt-8">
          <div className="p-3 rounded-full bg-primary/10">
            <Key className="text-primary" size={28} />
          </div>
          <h1 className="text-2xl font-bold">Auth Toolkit</h1>
          <p className="text-default-500 text-sm">Token Manager</p>
        </CardHeader>
        <CardBody className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuario"
              value={username}
              onValueChange={setUsername}
              autoFocus
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onValueChange={setPassword}
            />
            {error && (
              <p className="text-danger text-sm text-center">{error}</p>
            )}
            <Button
              type="submit"
              color="primary"
              className="w-full"
              isLoading={loading}
            >
              Iniciar sesion
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
