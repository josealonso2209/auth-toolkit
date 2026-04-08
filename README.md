# Auth Toolkit

Sistema de autenticacion enterprise basado en tokens opacos. Compuesto por dos microservicios independientes que trabajan en conjunto.

## Arquitectura

```
                          +------------------+
   Cualquier API/         |   auth-service   |    Microservicio ultra-rapido
   Microservicio  ------> |   (FastAPI)      |    Genera, valida y revoca
                          |   Puerto: 8100   |    tokens opacos en Redis
                          +--------+---------+
                                   |
                              Redis (tokens)
                                   |
                          +--------+---------+
   Administradores -----> |  token-manager   |    Panel de gestion con
                          |  (FastAPI+React) |    auditoria, RBAC, webhooks
                          |  Puerto: 8200    |    y metricas en PostgreSQL
                          +------------------+
```

## Componentes

### auth-service
Microservicio ligero de autenticacion. Responsable de:
- Generar tokens opacos criptograficamente seguros
- Validar tokens en microsegundos (Redis + cache local)
- Revocar tokens instantaneamente
- Rate limiting por servicio
- Scopes (permisos granulares)

### token-manager
Panel de administracion para gobernar el ecosistema de tokens:
- Dashboard analitico con metricas en tiempo real
- Control de acceso basado en roles (RBAC)
- Motor de auditoria inmutable (PostgreSQL)
- Webhooks para alertas de expiracion
- Generacion y revocacion de tokens via auth-service

## Stack Tecnologico

| Componente | Tecnologia |
|-----------|-----------|
| auth-service | Python 3.12, FastAPI, Redis, uvicorn |
| token-manager backend | Python 3.12, FastAPI, PostgreSQL, SQLAlchemy |
| token-manager frontend | React 18, TypeScript, Vite, Tailwind CSS, HeroUI |
| Contenedores | Docker, Docker Compose |

## Casos de Uso

Auth Toolkit es un **servidor de autenticacion service-to-service** basado en
client credentials con tokens opacos, scopes, rate limiting, auditoria y
revocacion instantanea. Esta diseñado para los siguientes escenarios:

### 1. Centralizacion de seguridad para microservicios
Punto unico de emision, validacion y revocacion de tokens para todos los
microservicios de tu plataforma. Cada servicio delega la verificacion en
`auth-service` (`POST /api/v1/tokens/verify` o introspect compatible con
RFC 7662) y aprovecha el cache local para latencias sub-milisegundo.

### 2. Backend de un API Gateway
Cualquier gateway (nginx, Traefik, Kong, FastAPI middleware) puede validar
los tokens emitidos por Auth Toolkit antes de enrutar al backend correspondiente.

### 3. API keys para integradores y partners externos
Cada partner se registra como un servicio con `client_id` + `client_secret`,
recibe scopes granulares, rate limit propio y puede ser revocado al instante.
Es el modelo que usan plataformas como Stripe, Twilio o SendGrid para sus API
keys de servidor.

### 4. Autenticacion de dispositivos IoT, edge y sensores
Cada dispositivo se registra como servicio y obtiene tokens de corta duracion
(TTL configurable) via client credentials. El lockout automatico tras intentos
fallidos mitiga ataques de fuerza bruta.

### 5. Credenciales para pipelines CI/CD y runners
GitHub Actions, GitLab CI, Jenkins o cualquier runner puede usar credenciales
unicas por pipeline, pedir tokens con scopes especificos (ej. `deploy:staging`)
y usarlos contra tus APIs internas. La auditoria queda registrada en PostgreSQL.

### 6. Cron jobs, batch jobs y workers de background
Cada worker tiene credenciales propias, solicita un token al arrancar y lo usa
contra otros servicios. Centraliza permisos sin meter secretos hardcodeados en
cada job.

### 7. SaaS multi-tenant con segmentacion por cliente
Cada tenant es un servicio independiente con sus scopes, rate limits y
actividad segregada. Vendes acceso a tu API y administras a todos tus clientes
desde un unico panel.

### 8. Hub centralizado de webhooks salientes con auditoria
El motor de webhooks del `token-manager` permite registrar destinos, firmarlos
con HMAC, entregarlos con reintentos y dejar trazabilidad completa de cada
entrega en `webhook_deliveries`.

### 9. Kill switch / centro de revocacion de emergencia
Ante un incidente de seguridad, una sola llamada
(`DELETE /api/v1/tokens/revoke-all/{service_id}`) invalida todos los tokens de
un servicio comprometido. Combinado con el cache local de TTL corto, todos los
microservicios dejan de aceptarle tokens en segundos.

> **Nota:** Auth Toolkit NO esta diseñado para autenticar usuarios finales en
> apps moviles/desktop ni para implementar SSO via OIDC/SAML. Para esos casos
> usa un Identity Provider especializado (Keycloak, Authentik, Ory) o extiende
> el proyecto con un modulo OIDC.

## Desarrollo

```bash
# Levantar todo el ecosistema
docker compose up -d

# Solo auth-service
docker compose up -d auth-service redis

# Solo token-manager
docker compose up -d token-manager postgres redis
```

## Licencia

MIT
