# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Project Management MVP: NextJS frontend + Python FastAPI backend, packaged in Docker. Features a Kanban board with drag-and-drop, login (hardcoded `user`/`password`), and an AI chat sidebar that can create/edit/move/delete cards via OpenRouter.

## Running the App

```bash
# Build and start (Mac/Linux)
./scripts/start-mac.sh   # or start-linux.sh / start-pc.cmd
./scripts/stop-mac.sh

# App runs at http://localhost:8000
```

The start script builds the Docker image and runs the container with `--env-file .env`. The SQLite DB is persisted at `./data/` via a volume mount.

## Development Commands

### Frontend (`cd frontend`)
```bash
npm install
npm run dev          # local dev server (not connected to backend)
npm run build        # static export to frontend/out/
npm run test         # Vitest unit tests (run once)
npm run test:unit:watch  # Vitest in watch mode
npm run test:e2e     # Playwright e2e tests
npm run test:all     # unit + e2e
npm run lint
```

Run a single Vitest test file:
```bash
npx vitest run src/components/KanbanBoard.test.tsx
```

Run a single Playwright test:
```bash
npx playwright test tests/kanban.spec.ts
```

### Backend (`cd backend`)
```bash
# Install deps (uses uv in Docker; locally use pip or uv)
uv pip install -r requirements.txt

# Run backend locally (from backend/)
uvicorn main:app --reload --port 8000

# Run tests
pytest
pytest test_api.py -v          # specific file
pytest test_api.py::test_login # specific test
```

## Architecture

### Request Flow
Browser → FastAPI (port 8000) → serves static NextJS files at `/`, API routes at `/api/*`

The frontend is built as a static export (`next.config.ts`: `output: 'export'`). Docker copies `frontend/out/` into `backend/static/`. FastAPI mounts that directory last (after all API routes).

### Backend (`backend/`)
- `main.py` — all FastAPI routes: auth, boards, cards, columns, AI chat
- `init_db.py` — SQLite schema init (runs on startup via lifespan); tables: `users`, `boards`, `columns`, `cards`, `sessions`, `ai_messages`
- `ai/client.py` — OpenAI-compatible client pointed at OpenRouter (`openai/gpt-oss-120b:free`)
- `GET /api/ai/test` — quick connectivity check for the AI (requires auth)

Auth uses JWT (HS256, 24h expiry). All board/card routes require `Authorization: Bearer <token>`.

AI chat (`POST /api/ai/chat`) sends board state + conversation history to the LLM, expects structured JSON back (`user_response` + `board_updates` array), then applies updates atomically to SQLite.

### Frontend (`frontend/src/`)
- `components/` — KanbanBoard, KanbanColumn, KanbanCard, KanbanCardPreview, NewCardForm, ChatSidebar, LoginPage
- `lib/kanban.ts` — Kanban state logic (pure functions)
- `lib/api.ts` — fetch wrapper for all backend API calls
- `contexts/auth.tsx` — session context (JWT stored in localStorage)

Drag-and-drop uses `@dnd-kit`. Board state is managed locally with optimistic updates synced to the backend.

## Environment

`.env` in project root (loaded by Docker via `--env-file`):
- `OPENROUTER_API_KEY` — required for AI features
- `JWT_SECRET` — optional (defaults to a dev secret)

## Design Tokens

CSS custom properties in `frontend/src/app/globals.css`:
- `--accent-yellow: #ecad0a` — highlights, accent lines
- `--primary-blue: #209dd7` — links, key sections
- `--secondary-purple: #753991` — submit buttons, important actions
- `--navy-dark: #032147` — main headings, foreground
- `--gray-text: #888888` — supporting text, labels

## Key Constraints

- No DB migrations — schema created on startup with `CREATE TABLE IF NOT EXISTS`; default user (`user`/`password`) and board (columns: Backlog, Discovery, In Progress, Review, Done) seeded in `init_db.py`
- MVP: single user, single board per user
- No emojis anywhere in the codebase or UI
- When hitting issues, identify the root cause with evidence before attempting a fix — do not guess
- DB lives at `backend/data/pm.db` locally; in Docker at `/app/data/pm.db` (host `./data/` is volume-mounted)
