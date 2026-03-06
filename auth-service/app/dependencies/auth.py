from fastapi import Request, HTTPException, status

from app.core import token_manager


def require_valid_token(request: Request) -> dict:
    """Dependencia FastAPI que valida el Bearer token del header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token requerido")

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Formato invalido")

    token_data = token_manager.verify_token(parts[1])
    if not token_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido o expirado")

    return token_data
