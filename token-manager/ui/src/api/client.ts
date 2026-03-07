const BASE = "";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const sessionId = localStorage.getItem("session_id");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (sessionId) headers["X-Session-Id"] = sessionId;

  const resp = await fetch(`${BASE}${path}`, { ...options, headers });

  if (resp.status === 401) {
    localStorage.removeItem("session_id");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || err.error || "Error desconocido");
  }

  return resp.json();
}

// Auth
export const login = (username: string, password: string) =>
  request<{ session_id: string; user: any }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const logout = () =>
  request("/api/auth/logout", { method: "POST" });

// Tokens
export const generateToken = (data: any) =>
  request<{ success: boolean; token: string; expires_in: number }>(
    "/api/tokens/generate",
    { method: "POST", body: JSON.stringify(data) }
  );

export const revokeToken = (token_id: string) =>
  request("/api/tokens/revoke", {
    method: "POST",
    body: JSON.stringify({ token_id }),
  });

export const listTokensStatus = () =>
  request<{ success: boolean; auth_service_status: any }>("/api/tokens/list");

export const listActiveTokens = () =>
  request<{ success: boolean; tokens: any[]; total: number; auth_service_status: any }>(
    "/api/tokens/list"
  );

// Services
export const listServices = () => request<any[]>("/api/services");

export const registerService = (data: any) =>
  request("/api/services/register", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteService = (serviceId: string) =>
  request(`/api/services/${serviceId}`, { method: "DELETE" });

// Users
export const listUsers = () => request<any[]>("/api/users");

export const createUser = (data: any) =>
  request("/api/users", { method: "POST", body: JSON.stringify(data) });

export const updateUser = (id: number, data: any) =>
  request(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteUser = (id: number) =>
  request(`/api/users/${id}`, { method: "DELETE" });

// Webhooks
export const listWebhooks = () => request<any[]>("/api/webhooks");

export const createWebhook = (data: any) =>
  request("/api/webhooks", { method: "POST", body: JSON.stringify(data) });

export const updateWebhook = (id: number, data: any) =>
  request(`/api/webhooks/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteWebhook = (id: number) =>
  request(`/api/webhooks/${id}`, { method: "DELETE" });

export const listDeliveries = (webhookId: number) =>
  request<any[]>(`/api/webhooks/${webhookId}/deliveries`);

// Audit
export const listAuditLogs = (params?: {
  action?: string;
  resource_type?: string;
  limit?: number;
  offset?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.action) qs.set("action", params.action);
  if (params?.resource_type) qs.set("resource_type", params.resource_type);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return request<any[]>(`/api/audit${query ? `?${query}` : ""}`);
};

export const countAuditLogs = () =>
  request<{ total: number }>("/api/audit/count");

// Health
export const healthCheck = () => request<any>("/health");
