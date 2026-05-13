from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from dependencies import assert_board_owner, current_user_id, now
from init_db import get_connection

router = APIRouter(prefix="/api/boards")


@router.get("/{board_id}")
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


@router.post("/{board_id}/cards", status_code=201)
def add_card(
    board_id: int,
    body: AddCardRequest,
    user_id: Annotated[int, Depends(current_user_id)],
):
    assert_board_owner(board_id, user_id)
    col_id = int(body.column_id)
    conn = get_connection()
    try:
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
    finally:
        conn.close()
    return {"id": card_id, "title": body.title, "details": body.details}


class UpdateCardRequest(BaseModel):
    title: str | None = None
    details: str | None = None
    column_id: str | None = None
    position: int | None = None


@router.put("/{board_id}/cards/{card_id}")
def update_card(
    board_id: int,
    card_id: int,
    body: UpdateCardRequest,
    user_id: Annotated[int, Depends(current_user_id)],
):
    assert_board_owner(board_id, user_id)
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
    conn.execute(
        "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
        (old_col, old_pos),
    )
    if position is None:
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ? AND id != ?",
            (new_col, card_id),
        ).fetchone()[0]
        position = max_pos + 1
    else:
        conn.execute(
            "UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?",
            (new_col, position),
        )
    conn.execute("UPDATE cards SET position = ? WHERE id = ?", (position, card_id))


@router.delete("/{board_id}/cards/{card_id}", status_code=204)
def delete_card(
    board_id: int,
    card_id: int,
    user_id: Annotated[int, Depends(current_user_id)],
):
    assert_board_owner(board_id, user_id)
    conn = get_connection()
    row = conn.execute("SELECT position, column_id FROM cards WHERE id = ?", (card_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Card not found")
    try:
        with conn:
            conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
            conn.execute(
                "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
                (row["column_id"], row["position"]),
            )
    finally:
        conn.close()


# ── Column routes ─────────────────────────────────────────────────────────────

class UpdateColumnRequest(BaseModel):
    title: str | None = None


@router.put("/{board_id}/columns/{column_id}")
def update_column(
    board_id: int,
    column_id: int,
    body: UpdateColumnRequest,
    user_id: Annotated[int, Depends(current_user_id)],
):
    assert_board_owner(board_id, user_id)
    conn = get_connection()
    col = conn.execute("SELECT * FROM columns WHERE id = ? AND board_id = ?", (column_id, board_id)).fetchone()
    if not col:
        conn.close()
        raise HTTPException(status_code=404, detail="Column not found")

    new_title = body.title if body.title is not None else col["title"]
    ts = now()
    try:
        with conn:
            conn.execute(
                "UPDATE columns SET title = ?, updated_at = ? WHERE id = ?",
                (new_title, ts, column_id),
            )
    finally:
        conn.close()
    return {"id": str(column_id), "title": new_title}
