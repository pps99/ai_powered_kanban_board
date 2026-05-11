import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()

import init_db as _idb

_idb.DB_PATH = Path(_tmp.name)

from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_db():
    _idb.DB_PATH = Path(_tmp.name)
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


def get_token_and_board() -> tuple[dict, int]:
    r = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    data = r.json()
    return {"Authorization": f"Bearer {data['token']}"}, data["board_id"]


def make_mock_completion(content: str):
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    completion = MagicMock()
    completion.choices = [choice]
    return completion


def test_ai_test_endpoint():
    headers, _ = get_token_and_board()
    mock_completion = make_mock_completion("4")

    with patch("ai.client._client") as mock_client:
        mock_client.chat.completions.create.return_value = mock_completion
        r = client.get("/api/ai/test", headers=headers)

    assert r.status_code == 200
    assert "answer" in r.json()


def test_ai_chat_adds_card():
    headers, board_id = get_token_and_board()
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    col_id = board["columns"][0]["id"]

    response_json = f'{{"user_response": "Added a card!", "board_updates": [{{"action": "add", "column_id": "{col_id}", "title": "AI task", "details": "From AI"}}]}}'
    mock_completion = make_mock_completion(response_json)

    with patch("ai.client._client") as mock_client:
        mock_client.chat.completions.create.return_value = mock_completion
        r = client.post(
            "/api/ai/chat",
            json={
                "board_id": board_id,
                "user_message": "Add a task called AI task",
                "board_state": board,
                "conversation_history": [],
            },
            headers=headers,
        )

    assert r.status_code == 200
    data = r.json()
    assert data["user_response"] == "Added a card!"
    assert len(data["board_updates"]) == 1

    board2 = client.get(f"/api/boards/{board_id}", headers=headers).json()
    titles = [board2["cards"][cid]["title"] for cid in board2["columns"][0]["cardIds"]]
    assert "AI task" in titles


def test_ai_chat_invalid_json_response():
    headers, board_id = get_token_and_board()
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()

    mock_completion = make_mock_completion("Sorry, I can't help with that.")

    with patch("ai.client._client") as mock_client:
        mock_client.chat.completions.create.return_value = mock_completion
        r = client.post(
            "/api/ai/chat",
            json={
                "board_id": board_id,
                "user_message": "hello",
                "board_state": board,
                "conversation_history": [],
            },
            headers=headers,
        )

    assert r.status_code == 200
    assert r.json()["user_response"] == "Sorry, I can't help with that."
    assert r.json()["board_updates"] == []


def test_ai_chat_stores_messages():
    headers, board_id = get_token_and_board()
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()

    response_json = '{"user_response": "Done!", "board_updates": []}'
    mock_completion = make_mock_completion(response_json)

    with patch("ai.client._client") as mock_client:
        mock_client.chat.completions.create.return_value = mock_completion
        client.post(
            "/api/ai/chat",
            json={
                "board_id": board_id,
                "user_message": "Hello AI",
                "board_state": board,
                "conversation_history": [],
            },
            headers=headers,
        )

    conn = _idb.get_connection()
    msgs = conn.execute(
        "SELECT role, content FROM ai_messages WHERE board_id = ? ORDER BY id",
        (board_id,),
    ).fetchall()
    conn.close()

    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "Hello AI"
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["content"] == "Done!"
