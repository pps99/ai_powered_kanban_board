from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from dependencies import assert_board_owner, current_user_id, make_token
from init_db import get_connection, hash_password

router = APIRouter(prefix="/api/auth")


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM users WHERE username = ? AND password_hash = ?",
        (body.username, hash_password(body.password)),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = make_token(row["id"])
    return {"token": token, "board_id": _get_board_id(row["id"])}


def _get_board_id(user_id: int) -> int:
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM boards WHERE user_id = ?", (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Board not found")
    return row["id"]


@router.post("/logout")
def logout(_uid: Annotated[int, Depends(current_user_id)]):
    return {"ok": True}
