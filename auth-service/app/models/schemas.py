from pydantic import BaseModel


# --- Requests ---


class TokenGenerateRequest(BaseModel):
    client_id: str
    client_secret: str
    scopes: list[str] = ["read"]
    access_ttl: int | None = None
    refresh_ttl: int | None = None
    metadata: dict | None = None


class TokenVerifyRequest(BaseModel):
    token: str


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class TokenIntrospectRequest(BaseModel):
    token: str


class ServiceRegisterRequest(BaseModel):
    service_id: str
    service_name: str
    client_id: str
    client_secret: str
    description: str = ""
    allowed_scopes: list[str] = ["read", "write"]
    rate_limit: int = 0


# --- Responses ---


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    scopes: list[str]
    service_id: str


class TokenVerifyResponse(BaseModel):
    valid: bool
    token_data: dict | None = None


class TokenIntrospectResponse(BaseModel):
    active: bool
    scope: str | None = None
    client_id: str | None = None
    token_type: str | None = None
    exp: int | None = None
    iat: int | None = None


class RevokeAllResponse(BaseModel):
    message: str
    service_id: str
    revoked_count: int


class ServiceRegisterResponse(BaseModel):
    message: str
    service_id: str


class ServiceDetailResponse(BaseModel):
    service_id: str
    service_name: str
    client_id: str
    description: str = ""
    allowed_scopes: list[str] = []
    rate_limit: int = 0
    is_active: bool = True
    created_at: str = ""
    active_tokens: int = 0


class ServiceListResponse(BaseModel):
    services: list[ServiceDetailResponse]
    total: int


class HealthResponse(BaseModel):
    status: str
    redis: str
    version: str
    uptime_seconds: float
    timestamp: str


class SuccessResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    error: str
    detail: str = ""
