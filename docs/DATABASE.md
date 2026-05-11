# Database Schema

SQLite database, created automatically on first run at `./data/pm.db`.

---

## Entity-Relationship Overview

```
users (1) ──< sessions (many)
users (1) ──< boards  (many)  [MVP: always 1 board per user]
boards(1) ──< columns (many)
columns(1)──< cards   (many)
boards (1) ──< ai_messages (many)
```

---

## Tables

### users

| Column       | Type    | Constraints              |
|--------------|---------|--------------------------|
| id           | INTEGER | PRIMARY KEY AUTOINCREMENT|
| username     | TEXT    | NOT NULL UNIQUE          |
| password_hash| TEXT    | NOT NULL                 |
| created_at   | TEXT    | NOT NULL (ISO-8601)      |

### sessions

| Column     | Type    | Constraints                        |
|------------|---------|------------------------------------|
| id         | INTEGER | PRIMARY KEY AUTOINCREMENT          |
| user_id    | INTEGER | NOT NULL, FK → users(id)           |
| token      | TEXT    | NOT NULL UNIQUE                    |
| expires_at | TEXT    | NOT NULL (ISO-8601)                |

### boards

| Column     | Type    | Constraints                        |
|------------|---------|------------------------------------|
| id         | INTEGER | PRIMARY KEY AUTOINCREMENT          |
| user_id    | INTEGER | NOT NULL, FK → users(id)           |
| name       | TEXT    | NOT NULL                           |
| created_at | TEXT    | NOT NULL (ISO-8601)                |
| updated_at | TEXT    | NOT NULL (ISO-8601)                |

### columns

| Column     | Type    | Constraints                        |
|------------|---------|------------------------------------|
| id         | INTEGER | PRIMARY KEY AUTOINCREMENT          |
| board_id   | INTEGER | NOT NULL, FK → boards(id)          |
| position   | INTEGER | NOT NULL                           |
| title      | TEXT    | NOT NULL                           |
| created_at | TEXT    | NOT NULL (ISO-8601)                |
| updated_at | TEXT    | NOT NULL (ISO-8601)                |

### cards

| Column     | Type    | Constraints                        |
|------------|---------|------------------------------------|
| id         | INTEGER | PRIMARY KEY AUTOINCREMENT          |
| column_id  | INTEGER | NOT NULL, FK → columns(id)         |
| position   | INTEGER | NOT NULL                           |
| title      | TEXT    | NOT NULL                           |
| details    | TEXT    | NOT NULL DEFAULT ''                |
| created_at | TEXT    | NOT NULL (ISO-8601)                |
| updated_at | TEXT    | NOT NULL (ISO-8601)                |

### ai_messages

| Column     | Type    | Constraints                        |
|------------|---------|------------------------------------|
| id         | INTEGER | PRIMARY KEY AUTOINCREMENT          |
| board_id   | INTEGER | NOT NULL, FK → boards(id)          |
| role       | TEXT    | NOT NULL ('user' or 'assistant')   |
| content    | TEXT    | NOT NULL                           |
| created_at | TEXT    | NOT NULL (ISO-8601)                |

---

## Initialization

Tables are created with `CREATE TABLE IF NOT EXISTS` on backend startup.
The default user (`user` / `password`) and their board with 5 columns is seeded if not present.
