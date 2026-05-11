import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Use a temporary DB for tests
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["TEST_DB_PATH"] = _tmp.name

import init_db as _idb

_idb.DB_PATH = Path(_tmp.name)

from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_db():
    _idb.DB_PATH = Path(_tmp.name)
    # Re-initialize fresh DB before each test
    conn = _idb.get_connection()
    conn.executescript("""
        DROP TABLE IF EXISTS ai_messages;
        DROP TABLE IF EXISTS cards;
        DROP TABLE IF EXISTS columns;
        DROP TABLE IF EXISTS boards;
        DROP TABLE IF EXISTS sessions;
        DROP TABLE IF EXISTS users;
    """)
    conn.close()
    _idb.init_db()
    yield


def login() -> dict:
    r = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert r.status_code == 200
    return r.json()


def auth_headers() -> dict:
    data = login()
    return {"Authorization": f"Bearer {data['token']}"}, data["board_id"]


# ── Auth ──────────────────────────────────────────────────────────────────────

def test_login_success():
    r = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert r.status_code == 200
    assert "token" in r.json()
    assert "board_id" in r.json()


def test_login_wrong_password():
    r = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert r.status_code == 401


def test_login_wrong_user():
    r = client.post("/api/auth/login", json={"username": "nobody", "password": "password"})
    assert r.status_code == 401


def test_logout():
    headers, _ = auth_headers()
    r = client.post("/api/auth/logout", headers=headers)
    assert r.status_code == 200


def test_protected_endpoint_without_token():
    r = client.get("/api/boards/1")
    assert r.status_code in (401, 403)


# ── Board ─────────────────────────────────────────────────────────────────────

def test_get_board():
    headers, board_id = auth_headers()
    r = client.get(f"/api/boards/{board_id}", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "columns" in data
    assert "cards" in data
    assert len(data["columns"]) == 5
    titles = [c["title"] for c in data["columns"]]
    assert titles == ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def test_get_board_wrong_user():
    headers, board_id = auth_headers()
    r = client.get(f"/api/boards/9999", headers=headers)
    assert r.status_code in (403, 404)


# ── Cards ─────────────────────────────────────────────────────────────────────

def test_add_card():
    headers, board_id = auth_headers()
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    col_id = board["columns"][0]["id"]

    r = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col_id, "title": "New task", "details": "Some details"},
        headers=headers,
    )
    assert r.status_code == 201
    card = r.json()
    assert card["title"] == "New task"
    assert card["details"] == "Some details"
    assert "id" in card


def test_add_card_appears_in_board():
    headers, board_id = auth_headers()
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    col_id = board["columns"][0]["id"]

    r = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col_id, "title": "Task", "details": ""},
        headers=headers,
    )
    card_id = r.json()["id"]

    board2 = client.get(f"/api/boards/{board_id}", headers=headers).json()
    assert card_id in board2["columns"][0]["cardIds"]
    assert card_id in board2["cards"]


def test_update_card_title():
    headers, board_id = auth_headers()
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    col_id = board["columns"][0]["id"]

    card_id = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col_id, "title": "Old title", "details": ""},
        headers=headers,
    ).json()["id"]

    r = client.put(
        f"/api/boards/{board_id}/cards/{card_id}",
        json={"title": "New title"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "New title"


def test_move_card_to_another_column():
    headers, board_id = auth_headers()
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    col1_id = board["columns"][0]["id"]
    col2_id = board["columns"][1]["id"]

    card_id = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col1_id, "title": "Movable", "details": ""},
        headers=headers,
    ).json()["id"]

    r = client.put(
        f"/api/boards/{board_id}/cards/{card_id}",
        json={"column_id": col2_id},
        headers=headers,
    )
    assert r.status_code == 200

    board2 = client.get(f"/api/boards/{board_id}", headers=headers).json()
    assert card_id not in board2["columns"][0]["cardIds"]
    assert card_id in board2["columns"][1]["cardIds"]


def test_delete_card():
    headers, board_id = auth_headers()
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    col_id = board["columns"][0]["id"]

    card_id = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col_id, "title": "Deletable", "details": ""},
        headers=headers,
    ).json()["id"]

    r = client.delete(f"/api/boards/{board_id}/cards/{card_id}", headers=headers)
    assert r.status_code == 204

    board2 = client.get(f"/api/boards/{board_id}", headers=headers).json()
    assert card_id not in board2["cards"]


def test_delete_nonexistent_card():
    headers, board_id = auth_headers()
    r = client.delete(f"/api/boards/{board_id}/cards/9999", headers=headers)
    assert r.status_code == 404


# ── Columns ───────────────────────────────────────────────────────────────────

def test_rename_column():
    headers, board_id = auth_headers()
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    col_id = board["columns"][0]["id"]

    r = client.put(
        f"/api/boards/{board_id}/columns/{col_id}",
        json={"title": "Sprint 1"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Sprint 1"

    board2 = client.get(f"/api/boards/{board_id}", headers=headers).json()
    assert board2["columns"][0]["title"] == "Sprint 1"


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
