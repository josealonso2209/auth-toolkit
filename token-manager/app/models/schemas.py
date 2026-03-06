from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# --- Auth ---


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    message: str
    session_id: str
    user: "UserResponse"


# --- Users ---


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "viewer"


class UserUpdate(BaseModel):
    email: str | None = None
    role: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Tokens (proxy al auth-service) ---


class TokenGenerateRequest(BaseModel):
    service_id: str
    service_name: str
    client_id: str
    client_secret: str
    scopes: list[str] = ["read"]
    expiration_days: int = 30


class TokenRevokeRequest(BaseModel):
    token_id: str


# --- Services (proxy al auth-service) ---


class ServiceRegisterRequest(BaseModel):
    service_id: str
    service_name: str
    client_id: str
    client_secret: str
    description: str = ""
    allowed_scopes: list[str] = ["read", "write"]
    rate_limit: int = 0


# --- Webhooks ---


class WebhookCreate(BaseModel):
    name: str
    url: str
    secret: str | None = None
    events: list[str]


class WebhookUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    secret: str | None = None
    events: list[str] | None = None
    is_active: bool | None = None


class WebhookResponse(BaseModel):
    id: int
    name: str
    url: str
    events: list[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class WebhookDeliveryResponse(BaseModel):
    id: int
    webhook_id: int
    event: str
    payload: dict
    response_status: int | None
    success: bool
    attempt: int
    delivered_at: datetime
    duration_ms: int | None

    model_config = {"from_attributes": True}


# --- Audit ---


class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    actor_username: str
    action: str
    resource_type: str
    resource_id: str | None
    detail: dict | None
    ip_address: str | None

    model_config = {"from_attributes": True}


# --- Generic ---


class MessageResponse(BaseModel):
    message: str
