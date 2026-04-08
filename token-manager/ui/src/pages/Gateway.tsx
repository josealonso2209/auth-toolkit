import { useState } from "react";
import {
  Button,
  Card,
  Chip,
  TextField,
  Label,
  Input,
} from "@heroui/react";
import {
  ShieldCheck,
  ShieldX,
  Copy,
  Check,
  Network,
  Zap,
  Code2,
  Info,
  Server,
  Clock,
} from "lucide-react";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";

type TestResult = {
  valid: boolean;
  latency_ms: number;
  token_data: {
    service_id?: string;
    service_name?: string;
    scopes?: string[];
    expires_at?: string;
    created_at?: string;
    [key: string]: any;
  } | null;
};

const VERIFY_URL_PLACEHOLDER = "https://auth.example.com/api/v1/tokens/verify";

const SNIPPETS: { id: string; label: string; description: string; lang: string; code: string }[] = [
  {
    id: "nginx",
    label: "nginx (auth_request)",
    description:
      "Subrequest a Auth Toolkit antes de proxiar al backend. Devuelve 401 si el token no es valido.",
    lang: "nginx",
    code: `# Protege /api/* validando el token con Auth Toolkit
location = /_auth {
    internal;
    proxy_pass      ${VERIFY_URL_PLACEHOLDER};
    proxy_method    POST;
    proxy_set_header Content-Type "application/json";
    proxy_set_body  '{"token":"$http_authorization"}';
    proxy_pass_request_body off;
}

location /api/ {
    auth_request     /_auth;
    auth_request_set $auth_status $upstream_status;

    error_page 401 = @unauthorized;
    proxy_pass http://backend_upstream;
}

location @unauthorized {
    return 401 '{"error":"invalid_token"}';
    add_header Content-Type application/json always;
}`,
  },
  {
    id: "kong",
    label: "Kong (pre-function)",
    description:
      "Plugin pre-function que valida el bearer token contra Auth Toolkit antes de enrutar al servicio.",
    lang: "lua",
    code: `-- kong.yml: pre-function plugin
plugins:
  - name: pre-function
    config:
      access:
        - |
          local http = require "resty.http"
          local cjson = require "cjson"

          local auth = kong.request.get_header("Authorization") or ""
          local token = auth:match("Bearer%\\s+(.+)")
          if not token then
            return kong.response.exit(401, { error = "missing_token" })
          end

          local httpc = http.new()
          local res, err = httpc:request_uri("${VERIFY_URL_PLACEHOLDER}", {
            method = "POST",
            body = cjson.encode({ token = token }),
            headers = { ["Content-Type"] = "application/json" },
          })

          if not res or res.status ~= 200 then
            return kong.response.exit(401, { error = "validation_failed" })
          end

          local body = cjson.decode(res.body)
          if not body.valid then
            return kong.response.exit(401, { error = "invalid_token" })
          end

          -- Pasa info al upstream como headers
          kong.service.request.set_header("X-Service-Id", body.token_data.service_id)
          kong.service.request.set_header("X-Scopes", table.concat(body.token_data.scopes, ","))`,
  },
  {
    id: "traefik",
    label: "Traefik (forwardAuth)",
    description:
      "Middleware forwardAuth que delega la validacion al endpoint de Auth Toolkit. Reenviado por header Authorization.",
    lang: "yaml",
    code: `# dynamic.yml
http:
  middlewares:
    auth-toolkit:
      forwardAuth:
        address: "${VERIFY_URL_PLACEHOLDER}"
        trustForwardHeader: true
        authResponseHeaders:
          - "X-Service-Id"
          - "X-Scopes"

  routers:
    api:
      rule: "PathPrefix(\`/api\`)"
      service: backend
      middlewares:
        - auth-toolkit

  services:
    backend:
      loadBalancer:
        servers:
          - url: "http://backend:8080"`,
  },
  {
    id: "envoy",
    label: "Envoy (ext_authz)",
    description:
      "Filtro ext_authz HTTP que llama a Auth Toolkit por cada request entrante. Aborta con 403 si el token no es valido.",
    lang: "yaml",
    code: `# envoy.yaml (filter chain)
http_filters:
  - name: envoy.filters.http.ext_authz
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.ext_authz.v3.ExtAuthz
      http_service:
        server_uri:
          uri: ${VERIFY_URL_PLACEHOLDER}
          cluster: auth_toolkit
          timeout: 1s
        authorization_request:
          allowed_headers:
            patterns:
              - exact: authorization
        authorization_response:
          allowed_upstream_headers:
            patterns:
              - exact: x-service-id
              - exact: x-scopes
      failure_mode_allow: false
  - name: envoy.filters.http.router

clusters:
  - name: auth_toolkit
    connect_timeout: 1s
    type: STRICT_DNS
    load_assignment:
      cluster_name: auth_toolkit
      endpoints:
        - lb_endpoints:
            - endpoint:
                address:
                  socket_address:
                    address: auth.example.com
                    port_value: 443`,
  },
];

function formatExpiry(iso?: string): { label: string; color: "success" | "warning" | "danger" } {
  if (!iso) return { label: "Sin fecha", color: "warning" };
  const expires = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = expires - now;
  if (diffMs <= 0) return { label: "Expirado", color: "danger" };
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const label = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  if (diffMs < 86400000) return { label, color: "danger" };
  if (diffMs < 7 * 86400000) return { label, color: "warning" };
  return { label, color: "success" };
}

export default function Gateway() {
  const [tab, setTab] = useState<"tester" | "snippets">("tester");
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [activeSnippet, setActiveSnippet] = useState<string>(SNIPPETS[0].id);

  const handleTest = async () => {
    if (!token.trim()) {
      toast.warning("Pega un token para probar");
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const res = await api.testToken(token.trim());
      setResult(res);
      if (res.valid) {
        toast.success(`Token valido (${res.latency_ms} ms)`);
      } else {
        toast.error("Token invalido o expirado");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al validar token");
    } finally {
      setTesting(false);
    }
  };

  const handleCopySnippet = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSnippet(id);
      toast.success("Snippet copiado");
      setTimeout(() => setCopiedSnippet(null), 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const current = SNIPPETS.find((s) => s.id === activeSnippet) ?? SNIPPETS[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-xl ring-1 ring-accent/20">
            <Network size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API Gateway</h1>
            <p className="text-muted mt-0.5">
              Tester de tokens y snippets de integracion para tu gateway favorito.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-default/10 rounded-xl w-fit">
        <button
          onClick={() => setTab("tester")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            tab === "tester"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Zap size={16} />
          Tester de Tokens
        </button>
        <button
          onClick={() => setTab("snippets")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            tab === "snippets"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Code2 size={16} />
          Snippets de Integracion
        </button>
      </div>

      {tab === "tester" && (
        <>
          <Card className="bg-surface/60 backdrop-blur-lg border border-border shadow-lg">
            <Card.Content className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Zap size={18} className="text-accent" />
                  Validar token
                </h2>
                <p className="text-sm text-muted mt-1">
                  Simula la llamada que hace tu API Gateway al validar un bearer token.
                </p>
              </div>

              <TextField>
                <Label>Token de acceso</Label>
                <Input
                  placeholder="Pega aqui un token opaco (ej: eyJhbGciOi... o el access_token devuelto al generar)"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="font-mono text-sm"
                />
              </TextField>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onPress={handleTest}
                  isPending={testing}
                  className="font-semibold shadow-lg shadow-accent/20"
                >
                  <Zap size={16} />
                  Validar Token
                </Button>
                {(token || result) && (
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setToken("");
                      setResult(null);
                    }}
                  >
                    Limpiar
                  </Button>
                )}
              </div>
            </Card.Content>
          </Card>

          {result && (
            <Card
              className={`border shadow-lg ${
                result.valid
                  ? "bg-success/5 border-success/30 shadow-success/5"
                  : "bg-danger/5 border-danger/30 shadow-danger/5"
              }`}
            >
              <Card.Content className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {result.valid ? (
                      <ShieldCheck size={28} className="text-success" />
                    ) : (
                      <ShieldX size={28} className="text-danger" />
                    )}
                    <div>
                      <h3
                        className={`text-lg font-bold ${
                          result.valid ? "text-success" : "text-danger"
                        }`}
                      >
                        {result.valid ? "Token Valido" : "Token Invalido"}
                      </h3>
                      <p className="text-xs text-muted">
                        {result.valid
                          ? "El auth-service acepto la validacion"
                          : "Token expirado, revocado o inexistente"}
                      </p>
                    </div>
                  </div>
                  <Chip
                    size="md"
                    variant="soft"
                    color={result.latency_ms < 50 ? "success" : result.latency_ms < 200 ? "warning" : "danger"}
                  >
                    <Clock size={12} className="inline mr-1" />
                    {result.latency_ms} ms
                  </Chip>
                </div>

                {result.valid && result.token_data && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted mb-1">
                        Servicio
                      </p>
                      <div className="flex items-center gap-2">
                        <Server size={14} className="text-muted" />
                        <p className="font-medium text-sm">
                          {result.token_data.service_name || "—"}
                        </p>
                      </div>
                      <p className="text-xs text-muted font-mono mt-0.5">
                        {result.token_data.service_id || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted mb-1">
                        Scopes
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(result.token_data.scopes || []).length === 0 && (
                          <span className="text-xs text-muted">Sin scopes</span>
                        )}
                        {(result.token_data.scopes || []).map((s) => (
                          <Chip
                            key={s}
                            size="sm"
                            variant="soft"
                            color={
                              s === "admin"
                                ? "danger"
                                : s === "write" || s === "delete"
                                  ? "warning"
                                  : "accent"
                            }
                          >
                            {s}
                          </Chip>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted mb-1">
                        Expira
                      </p>
                      {(() => {
                        const exp = formatExpiry(result.token_data?.expires_at);
                        return (
                          <div className="flex items-center gap-2">
                            <Chip size="sm" variant="soft" color={exp.color}>
                              {exp.label}
                            </Chip>
                            <span className="text-xs text-muted">
                              {result.token_data?.expires_at
                                ? new Date(result.token_data.expires_at).toLocaleString("es-ES")
                                : ""}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {result.token_data.created_at && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted mb-1">
                          Creado
                        </p>
                        <p className="text-sm">
                          {new Date(result.token_data.created_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card.Content>
            </Card>
          )}

          <Card className="bg-accent/5 border border-accent/10">
            <Card.Content className="p-5">
              <div className="flex gap-3">
                <Info className="text-accent shrink-0 mt-0.5" size={18} />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-accent">
                    Como usa esto un API Gateway
                  </h4>
                  <p className="text-xs text-muted leading-relaxed">
                    Tu gateway hace <code className="px-1 py-0.5 bg-default/20 rounded text-accent">POST /api/v1/tokens/verify</code>{" "}
                    en cada request entrante con el bearer token y bloquea la peticion si{" "}
                    <code className="px-1 py-0.5 bg-default/20 rounded">valid: false</code>. Mira la
                    pestana <strong>Snippets</strong> para ver ejemplos listos para nginx, Kong, Traefik o Envoy.
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card>
        </>
      )}

      {tab === "snippets" && (
        <Card className="bg-surface/60 backdrop-blur-lg border border-border shadow-lg">
          <Card.Content className="p-0">
            <div className="flex flex-wrap gap-1 p-3 border-b border-border">
              {SNIPPETS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSnippet(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeSnippet === s.id
                      ? "bg-accent text-accent-foreground"
                      : "bg-default/10 text-muted hover:bg-default/20"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-base">{current.label}</h3>
                  <p className="text-xs text-muted mt-1">{current.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => handleCopySnippet(current.id, current.code)}
                >
                  {copiedSnippet === current.id ? (
                    <>
                      <Check size={14} /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copiar
                    </>
                  )}
                </Button>
              </div>

              <pre className="bg-default/10 border border-border rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                <code>{current.code}</code>
              </pre>

              <div className="flex items-start gap-2 text-xs text-muted">
                <Info size={14} className="shrink-0 mt-0.5" />
                <p>
                  Reemplaza{" "}
                  <code className="px-1 py-0.5 bg-default/20 rounded text-accent">
                    auth.example.com
                  </code>{" "}
                  por la URL real de tu auth-service y configura los upstreams segun tu topologia.
                </p>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
