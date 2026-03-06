# Esquema de datos en Redis

Redis es el almacen principal del auth-service. Toda la data aqui requiere
validacion en microsegundos.

## Base de datos

| DB | Uso |
|----|-----|
| 0  | Tokens y servicios (auth-service) |

Cada sistema consumidor que quiera cachear validaciones usa su propia DB/instancia.

---

## Estructura de keys

### Tokens: `token:{token_id}`

Almacena los datos de un token opaco (access o refresh).

```
KEY:    token:a1b2c3d4e5f6...
TYPE:   STRING (JSON serializado)
TTL:    Definido al generar (access: 1h default, refresh: 30d default)
```

**Valor (access token):**
```json
{
  "token_type": "access",
  "service_id": "payment-service",
  "service_name": "Payment Service",
  "scopes": ["read", "write"],
  "created_at": "2026-03-06T14:00:00Z",
  "expires_at": "2026-03-06T15:00:00Z",
  "metadata": {}
}
```

**Valor (refresh token):**
```json
{
  "token_type": "refresh",
  "service_id": "payment-service",
  "service_name": "Payment Service",
  "access_token_id": "a1b2c3d4e5f6...",
  "created_at": "2026-03-06T14:00:00Z",
  "expires_at": "2026-04-05T14:00:00Z"
}
```

---

### Servicios: `service:{client_id}`

Registro permanente de un servicio consumidor.

```
KEY:    service:payment-svc
TYPE:   STRING (JSON serializado)
TTL:    Sin expiracion (persistente)
```

**Valor:**
```json
{
  "service_id": "payment-service",
  "service_name": "Payment Service",
  "client_id": "payment-svc",
  "client_secret_hash": "sha256:...",
  "description": "Servicio de pagos",
  "allowed_scopes": ["read", "write"],
  "rate_limit": 1000,
  "is_active": true,
  "created_at": "2026-03-06T14:00:00Z"
}
```

---

### Indice de tokens por servicio: `service_tokens:{service_id}`

SET que permite revocar todos los tokens de un servicio en una sola operacion.

```
KEY:    service_tokens:payment-service
TYPE:   SET
TTL:    Se actualiza al maximo TTL de sus tokens
VALUES: ["a1b2c3d4...", "e5f6g7h8..."]
```

---

### Rate limiting: `rate:{service_id}:{window}`

Contador para limitar validaciones por ventana de tiempo.

```
KEY:    rate:payment-service:202603061400
TYPE:   STRING (contador)
TTL:    60 segundos (ventana de 1 minuto)
VALUE:  "47"
```

**Logica:**
1. INCR en la key
2. Si es la primera vez (valor = 1), SET TTL a 60s
3. Si valor > rate_limit del servicio, rechazar con 429

---

### Bloqueo por intentos fallidos: `locked:{service_id}`

Flag temporal cuando un servicio excede intentos de autenticacion fallidos.

```
KEY:    locked:payment-svc
TYPE:   STRING
TTL:    300 segundos (5 minutos)
VALUE:  "1"
```

---

### Contador de intentos fallidos: `failed:{service_id}`

```
KEY:    failed:payment-svc
TYPE:   STRING (contador)
TTL:    300 segundos
VALUE:  "3"
```

---

## Patrones de acceso

| Operacion | Keys involucradas | Complejidad |
|-----------|-------------------|-------------|
| Generar token | `service:{cid}`, `token:{tid}`, `service_tokens:{sid}` | O(1) |
| Validar token | `token:{tid}` | O(1) |
| Revocar token | `token:{tid}`, `service_tokens:{sid}` | O(1) |
| Revocar todos | `service_tokens:{sid}`, N x `token:{tid}` | O(N) |
| Rate limit check | `rate:{sid}:{window}` | O(1) |
| Registrar servicio | `service:{cid}` | O(1) |

## Consideraciones de memoria

- Tokens son efimeros (TTL automatico), Redis se limpia solo
- Servicios son persistentes pero pocos (decenas, no miles)
- El indice `service_tokens` se limpia cuando expiran los tokens del SET
- Rate limit keys viven maximo 60 segundos
