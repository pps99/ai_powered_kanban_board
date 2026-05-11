import hashlib
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


DB_PATH = Path(__file__).parent / "data" / "pm.db"

DEFAULT_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def init_db() -> None:
    conn = get_connection()
    with conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT    NOT NULL UNIQUE,
                password_hash TEXT    NOT NULL,
                created_at    TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                token      TEXT    NOT NULL UNIQUE,
                expires_at TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS boards (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                name       TEXT    NOT NULL,
                created_at TEXT    NOT NULL,
                updated_at TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS columns (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                board_id   INTEGER NOT NULL REFERENCES boards(id),
                position   INTEGER NOT NULL,
                title      TEXT    NOT NULL,
                created_at TEXT    NOT NULL,
                updated_at TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cards (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                column_id  INTEGER NOT NULL REFERENCES columns(id),
                position   INTEGER NOT NULL,
                title      TEXT    NOT NULL,
                details    TEXT    NOT NULL DEFAULT '',
                created_at TEXT    NOT NULL,
                updated_at TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ai_messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                board_id   INTEGER NOT NULL REFERENCES boards(id),
                role       TEXT    NOT NULL,
                content    TEXT    NOT NULL,
                created_at TEXT    NOT NULL
            );
        """)

        # Seed default user if absent
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?", ("user",)
        ).fetchone()

        if existing is None:
            ts = now()
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
                ("user", hash_password("password"), ts),
            )
            user_id = cur.lastrowid

            cur = conn.execute(
                "INSERT INTO boards (user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (user_id, "My Board", ts, ts),
            )
            board_id = cur.lastrowid

            for pos, title in enumerate(DEFAULT_COLUMNS):
                conn.execute(
                    "INSERT INTO columns (board_id, position, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (board_id, pos, title, ts, ts),
                )

    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DB_PATH}")
