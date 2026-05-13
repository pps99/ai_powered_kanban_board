from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from dependencies import current_user_id, make_token
from init_db import get_connection, hash_password

router = APIRouter(prefix="/api/auth")


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    conn = get_connection()
    row = conn.execute(
        """
        SELECT u.id, b.id AS board_id
        FROM users u JOIN boards b ON b.user_id = u.id
        WHERE u.username = ? AND u.password_hash = ?
        """,
        (body.username, hash_password(body.password)),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": make_token(row["id"]), "board_id": row["board_id"]}


@router.post("/logout")
def logout(_uid: Annotated[int, Depends(current_user_id)]):
    return {"ok": True}
