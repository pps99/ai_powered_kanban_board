# Kanban Studio

A project management app with a Kanban board and an AI chat sidebar that can create, edit, move, and delete cards on your behalf.

## Stack

- **Frontend:** Next.js (static export), `@dnd-kit` for drag-and-drop, Tailwind CSS
- **Backend:** Python FastAPI, SQLite, JWT auth
- **AI:** OpenRouter (`openai/gpt-oss-120b:free`) via OpenAI-compatible client
- **Packaging:** Docker (single container serving both frontend and API)

## Setup

1. Copy `.env.example` to `.env` (or create `.env`) and add your key:

```
OPENROUTER_API_KEY=your_key_here
```

2. Start the app:

```bash
./scripts/start-mac.sh   # or start-linux.sh / start-pc.cmd
```

The app runs at `http://localhost:8000`. Log in with `user` / `password`.

To stop:

```bash
./scripts/stop-mac.sh
```

## Features

- Kanban board with drag-and-drop cards across columns
- Rename columns inline
- AI chat sidebar — describe what you want and the AI updates the board
- Board state persisted in SQLite (`./data/pm.db`)

## Development

### Frontend

```bash
cd frontend
npm install
npm run dev        # dev server at localhost:3000 (no backend connection)
npm run build      # static export to frontend/out/
npm run test       # unit tests (Vitest)
npm run test:e2e   # e2e tests (Playwright)
```

### Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
pytest
```

### Rebuilding the Docker image

```bash
./scripts/stop-mac.sh
./scripts/start-mac.sh
```
