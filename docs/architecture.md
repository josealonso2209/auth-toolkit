# Arquitectura

## Componentes

```
+-------------------+         +-------------------+
|   auth-service    |         |   token-manager   |
|   (FastAPI)       |         |   (FastAPI+React) |
|   Puerto: 8100    |         |   Puerto: 8200    |
+--------+----------+         +--------+----------+
         |                             |
         |  Genera/Valida/Revoca       |  Gobierna/Audita/Alerta
         |                             |
    +----v----+                   +----v--------+
    |  Redis  |                   | PostgreSQL  |
    |  DB 0   |                   | auth_toolkit|
    +---------+                   +-------------+
```

### auth-service
Microservicio stateless. Su unica responsabilidad es:
- Registrar servicios consumidores
- Generar tokens opacos (UUID + entropy → SHA-256)
- Validar tokens en microsegundos (cache local → Redis)
- Revocar tokens instantaneamente
- Rate limiting por servicio

**No tiene base de datos SQL.** Solo Redis.

### token-manager
Panel de administracion. Responsabilidades:
- Consumir la API del auth-service (nunca toca Redis directo)
- RBAC: admin, operator, viewer
- Auditoria inmutable en PostgreSQL
- Webhooks para alertas (expiracion, revocacion)
- Dashboard con metricas

## Flujo de validacion

```
Microservicio             auth-service              Redis
    |                          |                      |
    |-- POST /verify --------->|                      |
    |                          |-- Cache local? ----->|
    |                          |   (cachetools 5s)    |
    |                          |                      |
    |                          |-- Si no: GET key --->|
    |                          |<---- token_data -----|
    |                          |                      |
    |<--- {valid, scopes} -----|                      |
```

Latencia esperada:
- Cache local hit: < 1ms
- Redis hit: 1-3ms
- Token no encontrado: 1-3ms

## Flujo de generacion (via token-manager)

```
Admin (browser)       token-manager          auth-service       Redis
    |                      |                      |               |
    |-- Generar token ---->|                      |               |
    |                      |-- POST /tokens ----->|               |
    |                      |                      |-- SET key --->|
    |                      |<-- access+refresh ---|               |
    |                      |                      |               |
    |                      |-- LOG auditoria ---->|               |
    |                      |   (PostgreSQL)       |               |
    |<-- Token generado ---|                      |               |
```

## Flujo de revocacion (via token-manager)

```
Admin (browser)       token-manager          auth-service       Redis
    |                      |                      |               |
    |-- Revocar token ---->|                      |               |
    |                      |-- DELETE /tokens --->|               |
    |                      |                      |-- DEL key --->|
    |                      |<-- OK ---------------|               |
    |                      |                      |               |
    |                      |-- LOG auditoria ---->|               |
    |                      |-- FIRE webhooks ---->|               |
    |<-- Token revocado ---|                      |               |
```

## Modelo de datos

### Redis (auth-service)
Ver [redis-schema.md](redis-schema.md)

| Key pattern | Tipo | TTL | Proposito |
|------------|------|-----|-----------|
| `token:{id}` | STRING | access: 1h, refresh: 30d | Datos del token |
| `service:{client_id}` | STRING | Permanente | Registro de servicio |
| `service_tokens:{sid}` | SET | Max TTL de tokens | Indice para revocacion masiva |
| `rate:{sid}:{window}` | STRING | 60s | Rate limiting |
| `locked:{sid}` | STRING | 300s | Bloqueo por intentos fallidos |
| `failed:{sid}` | STRING | 300s | Contador de intentos fallidos |

### PostgreSQL (token-manager)
Ver [postgres-schema.sql](postgres-schema.sql)

| Tabla | Proposito |
|-------|-----------|
| `admin_users` | Usuarios del panel con roles (RBAC) |
| `audit_logs` | Registro inmutable de acciones |
| `webhooks` | Configuracion de webhooks |
| `webhook_deliveries` | Historial de entregas |
| `admin_sessions` | Sesiones activas |

## Seguridad

- Tokens opacos: UUID + entropy → SHA-256 (no JWT, no decodificable)
- Secrets hasheados: client_secret se almacena como SHA-256 en Redis
- Rate limiting: por servicio, ventana de 1 minuto
- Bloqueo automatico: 5 intentos fallidos → lockout 5 min
- Webhooks firmados: HMAC-SHA256 con secret por webhook
- RBAC: 3 roles con permisos granulares
- Auditoria: log inmutable de toda accion

## Variables de entorno

### auth-service
| Variable | Default | Descripcion |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Host de Redis |
| `REDIS_PORT` | `6379` | Puerto de Redis |
| `REDIS_DB` | `0` | Base de datos Redis |
| `REDIS_PASSWORD` | - | Password de Redis |
| `DEFAULT_ACCESS_TTL` | `3600` | TTL access token (segundos) |
| `DEFAULT_REFRESH_TTL` | `2592000` | TTL refresh token (segundos) |
| `LOCAL_CACHE_TTL` | `5` | TTL cache local cachetools (segundos) |
| `LOCAL_CACHE_MAXSIZE` | `10000` | Max entries en cache local |
| `MAX_FAILED_ATTEMPTS` | `5` | Intentos antes de lockout |
| `LOCKOUT_DURATION` | `300` | Duracion lockout (segundos) |

### token-manager
| Variable | Default | Descripcion |
|----------|---------|-------------|
| `AUTH_SERVICE_URL` | `http://auth-service:8100` | URL del auth-service |
| `DATABASE_URL` | - | Connection string PostgreSQL |
| `SECRET_KEY` | - | Key para sesiones y CSRF |
| `ADMIN_DEFAULT_PASSWORD` | - | Password inicial del admin |
