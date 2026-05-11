import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from init_db import get_connection, init_db, hash_password

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-please-change-in-production!!")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Project Management MVP", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth helpers ──────────────────────────────────────────────────────────────

def make_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


security = HTTPBearer()


def current_user_id(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> int:
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Auth routes ───────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
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


@app.post("/api/auth/logout")
def logout(_uid: Annotated[int, Depends(current_user_id)]):
    return {"ok": True}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Board routes ──────────────────────────────────────────────────────────────

@app.get("/api/boards/{board_id}")
def get_board(board_id: int, user_id: Annotated[int, Depends(current_user_id)]):
    conn = get_connection()
    board = conn.execute(
        "SELECT id, name FROM boards WHERE id = ? AND user_id = ?",
        (board_id, user_id),
    ).fetchone()
    if not board:
        conn.close()
        raise HTTPException(status_code=404, detail="Board not found")

    cols = conn.execute(
        "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()

    cards_rows = conn.execute(
        """
        SELECT c.id, c.column_id, c.title, c.details
        FROM cards c
        JOIN columns col ON col.id = c.column_id
        WHERE col.board_id = ?
        ORDER BY c.column_id, c.position
        """,
        (board_id,),
    ).fetchall()
    conn.close()

    cards_by_col: dict[int, list] = {col["id"]: [] for col in cols}
    cards_map: dict[str, dict] = {}
    for card in cards_rows:
        cid = str(card["id"])
        cards_map[cid] = {
            "id": cid,
            "title": card["title"],
            "details": card["details"],
        }
        cards_by_col[card["column_id"]].append(cid)

    columns = [
        {
            "id": str(col["id"]),
            "title": col["title"],
            "cardIds": cards_by_col[col["id"]],
        }
        for col in cols
    ]

    return {"id": board_id, "name": board["name"], "columns": columns, "cards": cards_map}


# ── Card routes ───────────────────────────────────────────────────────────────

class AddCardRequest(BaseModel):
    column_id: str
    title: str
    details: str = ""


@app.post("/api/boards/{board_id}/cards", status_code=201)
def add_card(
    board_id: int,
    body: AddCardRequest,
    user_id: Annotated[int, Depends(current_user_id)],
):
    _assert_board_owner(board_id, user_id)
    col_id = int(body.column_id)
    conn = get_connection()
    with conn:
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?", (col_id,)
        ).fetchone()[0]
        ts = now()
        cur = conn.execute(
            "INSERT INTO cards (column_id, position, title, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (col_id, max_pos + 1, body.title, body.details, ts, ts),
        )
    card_id = str(cur.lastrowid)
    conn.close()
    return {"id": card_id, "title": body.title, "details": body.details}


class UpdateCardRequest(BaseModel):
    title: str | None = None
    details: str | None = None
    column_id: str | None = None
    position: int | None = None


@app.put("/api/boards/{board_id}/cards/{card_id}")
def update_card(
    board_id: int,
    card_id: int,
    body: UpdateCardRequest,
    user_id: Annotated[int, Depends(current_user_id)],
):
    _assert_board_owner(board_id, user_id)
    conn = get_connection()
    card = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    if not card:
        conn.close()
        raise HTTPException(status_code=404, detail="Card not found")

    new_title = body.title if body.title is not None else card["title"]
    new_details = body.details if body.details is not None else card["details"]
    new_col = int(body.column_id) if body.column_id is not None else card["column_id"]
    ts = now()

    try:
        with conn:
            if body.column_id is not None or body.position is not None:
                _move_card(conn, card_id, card["column_id"], new_col, body.position)
            conn.execute(
                "UPDATE cards SET title = ?, details = ?, column_id = ?, updated_at = ? WHERE id = ?",
                (new_title, new_details, new_col, ts, card_id),
            )
    finally:
        conn.close()
    return {"id": str(card_id), "title": new_title, "details": new_details}


def _move_card(conn, card_id: int, old_col: int, new_col: int, position: int | None):
    old_pos = conn.execute("SELECT position FROM cards WHERE id = ?", (card_id,)).fetchone()["position"]
    # Remove from old position
    conn.execute(
        "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
        (old_col, old_pos),
    )
    if position is None:
        # Append to end
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ? AND id != ?",
            (new_col, card_id),
        ).fetchone()[0]
        position = max_pos + 1
    else:
        # Make space
        conn.execute(
            "UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?",
            (new_col, position),
        )
    conn.execute("UPDATE cards SET position = ? WHERE id = ?", (position, card_id))


@app.delete("/api/boards/{board_id}/cards/{card_id}", status_code=204)
def delete_card(
    board_id: int,
    card_id: int,
    user_id: Annotated[int, Depends(current_user_id)],
):
    _assert_board_owner(board_id, user_id)
    conn = get_connection()
    row = conn.execute("SELECT position, column_id FROM cards WHERE id = ?", (card_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Card not found")
    with conn:
        conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
        conn.execute(
            "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
            (row["column_id"], row["position"]),
        )
    conn.close()


# ── Column routes ─────────────────────────────────────────────────────────────

class UpdateColumnRequest(BaseModel):
    title: str | None = None
    position: int | None = None


@app.put("/api/boards/{board_id}/columns/{column_id}")
def update_column(
    board_id: int,
    column_id: int,
    body: UpdateColumnRequest,
    user_id: Annotated[int, Depends(current_user_id)],
):
    _assert_board_owner(board_id, user_id)
    conn = get_connection()
    col = conn.execute("SELECT * FROM columns WHERE id = ? AND board_id = ?", (column_id, board_id)).fetchone()
    if not col:
        conn.close()
        raise HTTPException(status_code=404, detail="Column not found")

    new_title = body.title if body.title is not None else col["title"]
    ts = now()
    with conn:
        conn.execute(
            "UPDATE columns SET title = ?, updated_at = ? WHERE id = ?",
            (new_title, ts, column_id),
        )
    conn.close()
    return {"id": str(column_id), "title": new_title}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _assert_board_owner(board_id: int, user_id: int):
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=403, detail="Forbidden")


# ── AI routes ────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a Kanban board assistant. The user will describe tasks they want done on the board.
You respond in JSON with two fields:
- "user_response": a short, friendly reply to the user
- "board_updates": a list of actions to apply to the board

Each action in board_updates has:
- "action": one of "add", "edit", "delete", "move"
- "card_id": ID of existing card (for edit/delete/move)
- "column_id": target column ID (for add/move)
- "position": 0-based position in column (optional, omit to append)
- "title": card title (for add/edit)
- "details": card details (for add/edit, optional)

Respond ONLY with valid JSON. No markdown, no code blocks."""


@app.get("/api/ai/test")
def ai_test(user_id: Annotated[int, Depends(current_user_id)]):
    from ai.client import get_client, MODEL
    client = get_client()
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "What is 2+2? Reply with just the number."}],
        max_tokens=10,
    )
    answer = response.choices[0].message.content
    return {"answer": answer}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    board_id: int
    user_message: str
    board_state: dict
    conversation_history: list[ChatMessage] = []


class BoardUpdate(BaseModel):
    action: str
    card_id: str | None = None
    column_id: str | None = None
    position: int | None = None
    title: str | None = None
    details: str | None = None


import json as _json


@app.post("/api/ai/chat")
def ai_chat(
    body: ChatRequest,
    user_id: Annotated[int, Depends(current_user_id)],
):
    from ai.client import get_client, MODEL
    _assert_board_owner(body.board_id, user_id)

    board_context = _json.dumps(body.board_state, indent=2)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Current board state:\n{board_context}\n\nUser request: {body.user_message}",
        },
    ]

    # Inject conversation history (last 10 turns)
    history = body.conversation_history[-10:]
    if history:
        messages = [messages[0]] + [{"role": m.role, "content": m.content} for m in history] + [messages[1]]

    client = get_client()
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=1000,
    )

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = _json.loads(raw)
    except _json.JSONDecodeError:
        parsed = {"user_response": raw, "board_updates": []}

    user_response = parsed.get("user_response", "Done.")
    updates_raw = parsed.get("board_updates", [])

    # Parse and apply updates
    updates = [BoardUpdate(**u) for u in updates_raw if isinstance(u, dict)]
    _apply_board_updates(body.board_id, updates)

    # Persist conversation
    conn = get_connection()
    ts = now()
    with conn:
        conn.execute(
            "INSERT INTO ai_messages (board_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (body.board_id, "user", body.user_message, ts),
        )
        conn.execute(
            "INSERT INTO ai_messages (board_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (body.board_id, "assistant", user_response, ts),
        )
    conn.close()

    return {"user_response": user_response, "board_updates": [u.model_dump() for u in updates]}


def _apply_board_updates(board_id: int, updates: list[BoardUpdate]):
    conn = get_connection()
    ts = now()
    try:
        with conn:
            for u in updates:
                if u.action == "add" and u.column_id and u.title:
                    col_id = int(u.column_id)
                    max_pos = conn.execute(
                        "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?", (col_id,)
                    ).fetchone()[0]
                    pos = u.position if u.position is not None else max_pos + 1
                    conn.execute(
                        "INSERT INTO cards (column_id, position, title, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                        (col_id, pos, u.title, u.details or "", ts, ts),
                    )
                elif u.action == "edit" and u.card_id:
                    card_id = int(u.card_id)
                    card = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
                    if card:
                        conn.execute(
                            "UPDATE cards SET title = ?, details = ?, updated_at = ? WHERE id = ?",
                            (u.title or card["title"], u.details if u.details is not None else card["details"], ts, card_id),
                        )
                elif u.action == "delete" and u.card_id:
                    card_id = int(u.card_id)
                    row = conn.execute("SELECT position, column_id FROM cards WHERE id = ?", (card_id,)).fetchone()
                    if row:
                        conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
                        conn.execute(
                            "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
                            (row["column_id"], row["position"]),
                        )
                elif u.action == "move" and u.card_id and u.column_id:
                    card_id = int(u.card_id)
                    new_col = int(u.column_id)
                    card = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
                    if card:
                        _move_card(conn, card_id, card["column_id"], new_col, u.position)
                        conn.execute(
                            "UPDATE cards SET column_id = ?, updated_at = ? WHERE id = ?",
                            (new_col, ts, card_id),
                        )
    finally:
        conn.close()


# ── Static files (must be last) ───────────────────────────────────────────────

static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
