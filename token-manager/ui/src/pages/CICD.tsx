import { useEffect, useState } from "react";
import {
  Button,
  Card,
  TextField,
  Label,
  Input,
} from "@heroui/react";
import {
  Copy,
  Check,
  GitBranch,
  Info,
  Wand2,
} from "lucide-react";
import * as api from "@/api/client";
import { toast } from "@/components/Toast";

type Platform = {
  id: string;
  label: string;
  description: string;
  filename: string;
  template: (ctx: SnippetCtx) => string;
};

type SnippetCtx = {
  serviceId: string;
  clientId: string;
  authUrl: string;
  scopes: string;
};

const DEFAULTS: SnippetCtx = {
  serviceId: "my-service",
  clientId: "my-client-id",
  authUrl: "https://auth.example.com",
  scopes: "read,write",
};

const PLATFORMS: Platform[] = [
  {
    id: "github",
    label: "GitHub Actions",
    description:
      "Workflow que solicita un token a Auth Toolkit, lo expone como secreto del job y lo revoca al final.",
    filename: ".github/workflows/deploy.yml",
    template: ({ serviceId, clientId, authUrl, scopes }) => `name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Solicitar token a Auth Toolkit
        id: auth
        run: |
          RESPONSE=$(curl -s -X POST "${authUrl}/api/v1/tokens" \\
            -H "Content-Type: application/json" \\
            -d '{
              "client_id": "${clientId}",
              "client_secret": "\${{ secrets.AUTH_TOOLKIT_SECRET }}",
              "scopes": ${JSON.stringify(scopes.split(",").map((s) => s.trim()))},
              "access_ttl": 1800
            }')
          TOKEN=$(echo $RESPONSE | jq -r '.access_token')
          echo "::add-mask::$TOKEN"
          echo "token=$TOKEN" >> $GITHUB_OUTPUT

      - name: Llamar API protegida
        env:
          AUTH_TOKEN: \${{ steps.auth.outputs.token }}
        run: |
          curl -H "Authorization: Bearer $AUTH_TOKEN" https://api.example.com/deploy

      - name: Revocar token
        if: always()
        run: |
          curl -s -X DELETE "${authUrl}/api/v1/tokens/\${{ steps.auth.outputs.token }}" \\
            -H "Authorization: Bearer \${{ steps.auth.outputs.token }}"
`,
  },
  {
    id: "gitlab",
    label: "GitLab CI",
    description:
      "Pipeline que obtiene un token efimero antes del job de despliegue y lo revoca como cleanup.",
    filename: ".gitlab-ci.yml",
    template: ({ serviceId, clientId, authUrl, scopes }) => `stages:
  - deploy

deploy:
  stage: deploy
  image: curlimages/curl:latest
  variables:
    AUTH_URL: "${authUrl}"
    CLIENT_ID: "${clientId}"
    SERVICE_ID: "${serviceId}"
  before_script:
    - apk add --no-cache jq
    - |
      RESPONSE=$(curl -s -X POST "$AUTH_URL/api/v1/tokens" \\
        -H "Content-Type: application/json" \\
        -d "{
          \\"client_id\\": \\"$CLIENT_ID\\",
          \\"client_secret\\": \\"$AUTH_TOOLKIT_SECRET\\",
          \\"scopes\\": ${JSON.stringify(scopes.split(",").map((s) => s.trim()))},
          \\"access_ttl\\": 1800
        }")
      export AUTH_TOKEN=$(echo $RESPONSE | jq -r '.access_token')
  script:
    - curl -H "Authorization: Bearer $AUTH_TOKEN" https://api.example.com/deploy
  after_script:
    - |
      curl -s -X DELETE "$AUTH_URL/api/v1/tokens/$AUTH_TOKEN" \\
        -H "Authorization: Bearer $AUTH_TOKEN"
  # Nota: define AUTH_TOOLKIT_SECRET en Settings > CI/CD > Variables (masked).
`,
  },
  {
    id: "jenkins",
    label: "Jenkins",
    description:
      "Declarative Pipeline con stage de auth, ejecucion y revocacion final usando withCredentials.",
    filename: "Jenkinsfile",
    template: ({ serviceId, clientId, authUrl, scopes }) => `pipeline {
  agent any
  environment {
    AUTH_URL  = '${authUrl}'
    CLIENT_ID = '${clientId}'
    SERVICE_ID = '${serviceId}'
  }
  stages {
    stage('Auth') {
      steps {
        withCredentials([string(credentialsId: 'auth-toolkit-secret', variable: 'CLIENT_SECRET')]) {
          script {
            def response = sh(
              script: """curl -s -X POST "$AUTH_URL/api/v1/tokens" \\
                -H "Content-Type: application/json" \\
                -d '{"client_id":"$CLIENT_ID","client_secret":"'"$CLIENT_SECRET"'","scopes":${JSON.stringify(scopes.split(",").map((s) => s.trim()))},"access_ttl":1800}'""",
              returnStdout: true
            ).trim()
            env.AUTH_TOKEN = readJSON(text: response).access_token
          }
        }
      }
    }
    stage('Deploy') {
      steps {
        sh 'curl -H "Authorization: Bearer $AUTH_TOKEN" https://api.example.com/deploy'
      }
    }
  }
  post {
    always {
      sh '''
        curl -s -X DELETE "$AUTH_URL/api/v1/tokens/$AUTH_TOKEN" \\
          -H "Authorization: Bearer $AUTH_TOKEN" || true
      '''
    }
  }
}
`,
  },
  {
    id: "circleci",
    label: "CircleCI",
    description:
      "Workflow con un job de auth que comparte el token via workspace al job de despliegue.",
    filename: ".circleci/config.yml",
    template: ({ serviceId, clientId, authUrl, scopes }) => `version: 2.1

jobs:
  auth:
    docker:
      - image: cimg/base:stable
    steps:
      - run:
          name: Solicitar token
          command: |
            RESPONSE=$(curl -s -X POST "${authUrl}/api/v1/tokens" \\
              -H "Content-Type: application/json" \\
              -d '{
                "client_id": "${clientId}",
                "client_secret": "'"$AUTH_TOOLKIT_SECRET"'",
                "scopes": ${JSON.stringify(scopes.split(",").map((s) => s.trim()))},
                "access_ttl": 1800
              }')
            mkdir -p /tmp/workspace
            echo $RESPONSE | jq -r '.access_token' > /tmp/workspace/token
      - persist_to_workspace:
          root: /tmp/workspace
          paths:
            - token

  deploy:
    docker:
      - image: cimg/base:stable
    steps:
      - attach_workspace:
          at: /tmp/workspace
      - run:
          name: Desplegar con token
          command: |
            export AUTH_TOKEN=$(cat /tmp/workspace/token)
            curl -H "Authorization: Bearer $AUTH_TOKEN" https://api.example.com/deploy
      - run:
          name: Revocar token (cleanup)
          when: always
          command: |
            export AUTH_TOKEN=$(cat /tmp/workspace/token)
            curl -s -X DELETE "${authUrl}/api/v1/tokens/$AUTH_TOKEN" \\
              -H "Authorization: Bearer $AUTH_TOKEN"

workflows:
  deploy_pipeline:
    jobs:
      - auth
      - deploy:
          requires: [auth]
# Nota: define AUTH_TOOLKIT_SECRET en Project Settings > Environment Variables.
`,
  },
];

export default function CICD() {
  const [active, setActive] = useState<string>(PLATFORMS[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [ctx, setCtx] = useState<SnippetCtx>(DEFAULTS);

  useEffect(() => {
    api
      .listServices()
      .then((data) => setServices(data || []))
      .catch(() => {
        /* silenciar */
      });
  }, []);

  const onSelectService = (id: string) => {
    if (!id) {
      setCtx((c) => ({ ...c, serviceId: DEFAULTS.serviceId, clientId: DEFAULTS.clientId }));
      return;
    }
    const svc = services.find((s: any) => s.service_id === id);
    if (svc) {
      setCtx((c) => ({
        ...c,
        serviceId: svc.service_id,
        clientId: svc.client_id,
        scopes: (svc.allowed_scopes || ["read"]).join(","),
      }));
    }
  };

  const handleCopy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(id);
      toast.success("Snippet copiado");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const platform = PLATFORMS.find((p) => p.id === active) ?? PLATFORMS[0];
  const code = platform.template(ctx);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent/10 rounded-xl ring-1 ring-accent/20">
          <GitBranch size={22} className="text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CI/CD</h1>
          <p className="text-muted mt-0.5">
            Plantillas listas para integrar Auth Toolkit en tus pipelines de despliegue.
          </p>
        </div>
      </div>

      {/* Wizard de personalizacion */}
      <Card className="bg-surface/60 backdrop-blur-lg border border-border shadow-lg">
        <Card.Content className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wand2 size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Personalizar snippet</h2>
          </div>
          <p className="text-xs text-muted">
            Elige un servicio registrado o ajusta los campos para que los snippets generen el codigo
            con tus valores reales.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Servicio registrado</label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                onChange={(e) => onSelectService(e.target.value)}
                defaultValue=""
              >
                <option value="">— Sin seleccion (usa valores por defecto) —</option>
                {services.map((s: any) => (
                  <option key={s.service_id} value={s.service_id}>
                    {s.service_name} ({s.service_id})
                  </option>
                ))}
              </select>
            </div>

            <TextField>
              <Label>URL del auth-service</Label>
              <Input
                value={ctx.authUrl}
                onChange={(e) => setCtx({ ...ctx, authUrl: e.target.value })}
                placeholder="https://auth.example.com"
              />
            </TextField>

            <TextField>
              <Label>Service ID</Label>
              <Input
                value={ctx.serviceId}
                onChange={(e) => setCtx({ ...ctx, serviceId: e.target.value })}
              />
            </TextField>

            <TextField>
              <Label>Client ID</Label>
              <Input
                value={ctx.clientId}
                onChange={(e) => setCtx({ ...ctx, clientId: e.target.value })}
              />
            </TextField>

            <TextField className="md:col-span-2">
              <Label>Scopes (separados por coma)</Label>
              <Input
                value={ctx.scopes}
                onChange={(e) => setCtx({ ...ctx, scopes: e.target.value })}
              />
            </TextField>
          </div>
        </Card.Content>
      </Card>

      {/* Tabs + snippet */}
      <Card className="bg-surface/60 backdrop-blur-lg border border-border shadow-lg">
        <Card.Content className="p-0">
          <div className="flex flex-wrap gap-1 p-3 border-b border-border">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active === p.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-default/10 text-muted hover:bg-default/20"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-base">{platform.label}</h3>
                <p className="text-xs text-muted mt-1">{platform.description}</p>
                <code className="inline-block mt-2 text-xs bg-default/10 px-2 py-1 rounded text-accent font-mono">
                  {platform.filename}
                </code>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => handleCopy(platform.id, code)}
              >
                {copied === platform.id ? (
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
              <code>{code}</code>
            </pre>
          </div>
        </Card.Content>
      </Card>

      {/* Tip */}
      <Card className="bg-accent/5 border border-accent/10">
        <Card.Content className="p-5">
          <div className="flex gap-3">
            <Info className="text-accent shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-accent">Buenas practicas para CI/CD</h4>
              <ul className="text-xs text-muted space-y-1 list-disc ml-4">
                <li>
                  Usa un <strong>access_ttl corto</strong> (1800 = 30 min) — el token solo necesita
                  vivir lo que dura el job.
                </li>
                <li>
                  Guarda <code className="px-1 bg-default/20 rounded">client_secret</code> en el
                  vault de secretos de tu CI (nunca en el repo).
                </li>
                <li>
                  <strong>Revoca el token</strong> en el cleanup del job ({"`if: always()`"} /
                  {" `after_script` / `post`"}) por si el deploy falla.
                </li>
                <li>
                  Crea un servicio dedicado por pipeline (ej.{" "}
                  <code className="px-1 bg-default/20 rounded">ci-deploy-prod</code>) con el minimo
                  de scopes que necesite.
                </li>
              </ul>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
