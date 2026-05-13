import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from init_db import get_connection, now

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-please-change-in-production!!")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()


def make_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def current_user_id(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> int:
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def assert_board_owner(board_id: int, user_id: int):
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=403, detail="Forbidden")
