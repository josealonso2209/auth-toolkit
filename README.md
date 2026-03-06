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
