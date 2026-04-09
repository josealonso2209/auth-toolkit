export interface PartnerQuota {
  max_services: number;
  max_rate_limit: number;
  allowed_scopes: string[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: "admin" | "operator" | "viewer" | "partner";
  is_active: boolean;
  partner_quota: PartnerQuota | null;
  created_at: string;
}

export interface PartnerKey {
  service_id: string;
  service_name: string;
  client_id: string;
  scopes: string[];
  rate_limit: number;
  is_active: boolean;
  created_at: string;
}

export interface PartnerQuotaInfo {
  quota: PartnerQuota;
  usage: { services_used: number };
}

export interface AuditLog {
  id: number;
  timestamp: string;
  actor_username: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  detail: Record<string, unknown> | null;
  ip_address: string | null;
}

export interface Webhook {
  id: number;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: number;
  webhook_id: number;
  event: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  success: boolean;
  attempt: number;
  delivered_at: string;
  duration_ms: number | null;
}

export interface TokenGeneratePayload {
  service_id: string;
  service_name: string;
  client_id: string;
  client_secret: string;
  scopes: string[];
  expiration_days: number;
}

export interface ActiveToken {
  token_id: string;
  full_token_id: string;
  service_id: string;
  service_name: string;
  scopes: string[];
  created_at: string;
  expires_at: string;
  ttl_seconds: number;
}

export interface ServiceRegisterPayload {
  service_id: string;
  service_name: string;
  client_id: string;
  client_secret: string;
  description: string;
  allowed_scopes: string[];
  rate_limit: number;
}
