-- =============================================================================
-- Auth Toolkit - Esquema PostgreSQL
-- Base de datos del token-manager (gobernanza, auditoria, RBAC, webhooks)
-- =============================================================================

-- ----- Usuarios administradores (RBAC) -----

CREATE TABLE admin_users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'viewer',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_role CHECK (role IN ('admin', 'operator', 'viewer'))
);

COMMENT ON TABLE admin_users IS 'Usuarios del panel token-manager con roles';
COMMENT ON COLUMN admin_users.role IS 'admin: acceso total | operator: generar/revocar | viewer: solo lectura';

-- ----- Logs de auditoria (inmutable) -----

CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id        INTEGER REFERENCES admin_users(id),
    actor_username  VARCHAR(100) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    resource_type   VARCHAR(50) NOT NULL,
    resource_id     VARCHAR(255),
    detail          JSONB,
    ip_address      INET,
    user_agent      TEXT,

    CONSTRAINT chk_action CHECK (action IN (
        'token.generate',
        'token.revoke',
        'token.revoke_all',
        'token.refresh',
        'service.register',
        'service.delete',
        'service.update',
        'user.login',
        'user.logout',
        'user.create',
        'user.update',
        'user.delete',
        'webhook.create',
        'webhook.update',
        'webhook.delete',
        'webhook.test'
    )),
    CONSTRAINT chk_resource_type CHECK (resource_type IN (
        'token', 'service', 'user', 'webhook'
    ))
);

CREATE INDEX idx_audit_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs (action);
CREATE INDEX idx_audit_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_actor ON audit_logs (actor_id);

COMMENT ON TABLE audit_logs IS 'Registro inmutable de todas las acciones del sistema';

-- ----- Configuracion de webhooks -----

CREATE TABLE webhooks (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    url             VARCHAR(2048) NOT NULL,
    secret          VARCHAR(255),
    events          TEXT[] NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      INTEGER REFERENCES admin_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_events CHECK (events <@ ARRAY[
        'token.generated',
        'token.revoked',
        'token.expired',
        'token.expiring_soon',
        'service.registered',
        'service.deleted'
    ]::TEXT[])
);

COMMENT ON TABLE webhooks IS 'Configuracion de webhooks para notificaciones';
COMMENT ON COLUMN webhooks.secret IS 'Secret para firmar payloads (HMAC-SHA256)';
COMMENT ON COLUMN webhooks.events IS 'Lista de eventos que disparan este webhook';

-- ----- Historial de entregas de webhooks -----

CREATE TABLE webhook_deliveries (
    id              BIGSERIAL PRIMARY KEY,
    webhook_id      INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event           VARCHAR(50) NOT NULL,
    payload         JSONB NOT NULL,
    response_status INTEGER,
    response_body   TEXT,
    success         BOOLEAN NOT NULL DEFAULT FALSE,
    attempt         INTEGER NOT NULL DEFAULT 1,
    delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms     INTEGER
);

CREATE INDEX idx_delivery_webhook ON webhook_deliveries (webhook_id, delivered_at DESC);
CREATE INDEX idx_delivery_success ON webhook_deliveries (success) WHERE NOT success;

COMMENT ON TABLE webhook_deliveries IS 'Historial de entregas de webhooks con reintentos';

-- ----- Sesiones de administradores -----

CREATE TABLE admin_sessions (
    id              VARCHAR(64) PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_session_user ON admin_sessions (user_id) WHERE is_active;
CREATE INDEX idx_session_expires ON admin_sessions (expires_at) WHERE is_active;

COMMENT ON TABLE admin_sessions IS 'Sesiones activas del panel de administracion';

-- ----- Funcion para updated_at automatico -----

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_users_updated
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_webhooks_updated
    BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
