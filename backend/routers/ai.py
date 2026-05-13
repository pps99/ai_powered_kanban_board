import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from dependencies import assert_board_owner, current_user_id, now
from init_db import get_connection
from routers.boards import _move_card

router = APIRouter(prefix="/api/ai")

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


@router.get("/test")
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
    action: Literal["add", "edit", "delete", "move"]
    card_id: str | None = None
    column_id: str | None = None
    position: int | None = None
    title: str | None = None
    details: str | None = None


@router.post("/chat")
def ai_chat(
    body: ChatRequest,
    user_id: Annotated[int, Depends(current_user_id)],
):
    from ai.client import get_client, MODEL
    assert_board_owner(body.board_id, user_id)

    board_context = json.dumps(body.board_state)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Current board state:\n{board_context}\n\nUser request: {body.user_message}",
        },
    ]

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
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"user_response": raw, "board_updates": []}

    user_response = parsed.get("user_response", "Done.")
    updates_raw = parsed.get("board_updates", [])

    updates = [BoardUpdate(**u) for u in updates_raw if isinstance(u, dict)]
    _apply_board_updates(body.board_id, updates)

    conn = get_connection()
    ts = now()
    try:
        with conn:
            conn.execute(
                "INSERT INTO ai_messages (board_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                (body.board_id, "user", body.user_message, ts),
            )
            conn.execute(
                "INSERT INTO ai_messages (board_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                (body.board_id, "assistant", user_response, ts),
            )
    finally:
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
