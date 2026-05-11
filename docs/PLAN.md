# Project Management MVP - Detailed Implementation Plan

## Overview

This is a 10-part implementation plan to build a Project Management MVP featuring a Kanban board with AI-powered task management. The app will run in Docker with a NextJS frontend and Python FastAPI backend.

**Testing Frameworks:**
- Frontend: Vitest + Playwright
- Backend: pytest

**Key Tech Stack:**
- Frontend: NextJS 16, React 19, Vitest, Playwright
- Backend: FastAPI, Python with uv package manager
- Database: SQLite (local)
- AI: OpenRouter (openai/gpt-oss-120b:free)

---

## Part 1: Planning & Documentation

**Objective:** Enrich planning documents and establish a baseline understanding of the existing frontend code.

### Substeps
- [ ] Review existing frontend code structure and components
- [ ] Document frontend architecture in frontend/AGENTS.md
- [ ] Create detailed breakdown for all 10 parts with:
  - Substeps for each part (checklist format)
  - Clear test/acceptance criteria
  - Success metrics
- [ ] Get user approval on the complete plan

### Tests & Success Criteria
- [ ] frontend/AGENTS.md exists and accurately describes the current codebase
- [ ] docs/PLAN.md (this file) includes detailed substeps for all parts
- [ ] Each part has clear test criteria and acceptance conditions
- [ ] User has reviewed and approved the plan

---

## Part 2: Docker & Backend Scaffolding

**Objective:** Set up Docker infrastructure, FastAPI backend scaffolding, and start/stop scripts. Verify with a "hello world" static HTML and API call.

### Substeps
- [ ] Create Dockerfile with Python 3.12+, uv package manager
- [ ] Create .dockerignore to exclude unnecessary files
- [ ] Create backend/ directory structure (main.py, requirements.txt, app/)
- [ ] Initialize FastAPI app with basic middleware (CORS, error handling)
- [ ] Create /health endpoint (returns JSON status)
- [ ] Create static HTML "hello world" page in backend/static/
- [ ] Serve static files at / (FastAPI StaticFiles)
- [ ] Write start scripts: scripts/start-mac.sh, scripts/start-pc.cmd, scripts/start-linux.sh
- [ ] Write stop scripts (scripts/stop-mac.sh, etc.)
- [ ] Test locally: app loads at http://localhost:8000, /health endpoint works
- [ ] Verify API call from frontend can reach backend

### Tests & Success Criteria
- Docker builds without errors
- Container starts and logs show FastAPI running on port 8000
- Visiting http://localhost:8000 returns hello world HTML
- Calling http://localhost:8000/health returns { "status": "ok" }
- Start/stop scripts work on Mac/Linux/Windows

---

## Part 3: Static Frontend Integration

**Objective:** Build and serve the NextJS frontend statically from the backend. Kanban board displays at /.

### Substeps
- [ ] Configure next.config.ts to build as static export (output: 'export')
- [ ] Update frontend build to output to backend/static/out/
- [ ] Update backend to serve frontend from /static/out/
- [ ] Test: npm run build in frontend, then docker build + run backend
- [ ] Verify Kanban board loads at http://localhost:8000
- [ ] Write unit tests for Kanban components (>80% coverage target)
- [ ] Write integration tests for drag-and-drop, column rename, card add/delete
- [ ] Update README with build instructions

### Tests & Success Criteria
- Frontend builds without errors
- Kanban board displays at http://localhost:8000
- Vitest unit tests: all passing
- Playwright e2e tests: drag-drop works, column rename works, card ops work
- No console errors in browser

---

## Part 4: Login/Logout Flow

**Objective:** Add authentication screen. Users must log in with "user"/"password" to see Kanban. Session persists on page reload.

### Substeps
- [ ] Create LoginPage component (email/password form)
- [ ] Create Session context/hook for auth state
- [ ] Implement client-side session management (localStorage)
- [ ] Add login validation (hardcoded credentials: user/password)
- [ ] Redirect to login if not authenticated
- [ ] Add logout button on Kanban page
- [ ] Persist session on localStorage; restore on page load
- [ ] Create ProtectedRoute wrapper component
- [ ] Write tests for login flow (success, failure, session persistence)
- [ ] Write tests for logout flow
- [ ] Update frontend build process

### Tests & Success Criteria
- Login page displays when not authenticated
- Login fails with wrong credentials
- Login succeeds with "user"/"password"
- Session persists across page reload
- Logout clears session and redirects to login
- Unit tests: >80% coverage
- E2E tests: full login→logout flow works

---

## Part 5: Database Schema & Modeling

**Objective:** Design and document SQLite schema for persisting Kanban boards, columns, cards, and user sessions.

### Substeps
- [ ] Design database schema:
  - users table (id, username, password_hash, created_at)
  - boards table (id, user_id, name, created_at, updated_at)
  - columns table (id, board_id, position, title, created_at, updated_at)
  - cards table (id, column_id, position, title, details, created_at, updated_at)
  - sessions table (id, user_id, token, expires_at)
  - ai_messages table (id, board_id, role, content, created_at)
- [ ] Save schema to docs/DATABASE.md with ERD diagram (ASCII art ok)
- [ ] Document relationships and constraints
- [ ] Create migration strategy (create if not exists on startup)
- [ ] Write schema initialization SQL in backend/init_db.py
- [ ] Get user sign-off on schema

### Tests & Success Criteria
- docs/DATABASE.md exists with clear schema documentation
- Database initializes correctly on first run
- All relationships and constraints are enforced
- Schema supports MVP requirements (single user, single board)
- User has reviewed and approved the schema

---

## Part 6: Backend API Routes & Database Integration

**Objective:** Implement RESTful API for CRUD operations on Kanban board. Backend reads/writes to SQLite.

### Substeps
- [ ] Create /api/auth/login POST endpoint (validate username/password, return token)
- [ ] Create /api/auth/logout POST endpoint
- [ ] Create /api/boards/{board_id} GET (fetch board with columns and cards)
- [ ] Create /api/boards/{board_id}/cards POST (add new card)
- [ ] Create /api/boards/{board_id}/cards/{card_id} PUT (update card)
- [ ] Create /api/boards/{board_id}/cards/{card_id} DELETE (delete card)
- [ ] Create /api/boards/{board_id}/columns/{column_id} PUT (rename column, reorder)
- [ ] Implement JWT token generation and validation middleware
- [ ] Create database connection pooling
- [ ] Add migration runner: create tables if not exist on startup
- [ ] Error handling: return appropriate HTTP status codes
- [ ] Write pytest unit tests for each endpoint (test success + failure cases)
- [ ] Write integration tests: full CRUD flow with database

### Tests & Success Criteria
- All endpoints return correct HTTP status codes
- Database persists data correctly
- JWT validation works
- Tests: >80% coverage of API routes
- pytest unit tests: all passing
- pytest integration tests: all passing
- Database file is created automatically on first run

---

## Part 7: Frontend ↔ Backend Integration

**Objective:** Connect frontend to backend API. Kanban board is now persistent across sessions.

### Substeps
- [ ] Update login to call /api/auth/login and store JWT
- [ ] Add JWT header to all API requests (interceptor/fetch wrapper)
- [ ] Update KanbanBoard to fetch data from /api/boards/{board_id} on mount
- [ ] Update card add/edit/delete to call backend API
- [ ] Update column rename to call backend API
- [ ] Add loading states during API calls
- [ ] Add error boundaries and error toasts
- [ ] Implement optimistic UI updates (update locally, sync with server)
- [ ] Write integration tests: login → fetch board → modify → verify persistence
- [ ] Test refresh persistence (reload page, board data persists)
- [ ] Test multiple operations in sequence

### Tests & Success Criteria
- Login flow uses backend API
- Kanban board loads from backend API
- All card/column operations persist to database
- Page reload shows persisted data
- Loading states display during API calls
- Error toasts display on API failures
- E2E tests: login → create card → refresh → card still exists

---

## Part 8: AI Connectivity Setup

**Objective:** Connect backend to OpenRouter API. Verify AI connectivity with simple test call.

### Substeps
- [ ] Read OPENROUTER_API_KEY from .env file
- [ ] Create OpenRouter client wrapper in backend/ai/client.py
- [ ] Create POST /api/ai/test endpoint
- [ ] Test endpoint calls AI with simple query ("What is 2+2?")
- [ ] Verify response and log it
- [ ] Write pytest test to validate AI connectivity
- [ ] Handle rate limits, timeouts, errors gracefully
- [ ] Document AI integration in docs/AI.md

### Tests & Success Criteria
- OpenRouter API key is read from .env correctly
- /api/ai/test endpoint returns AI response
- Response is valid JSON with expected structure
- Error handling works for invalid API key
- Timeout handling works
- Test passes: simple "2+2" query returns correct answer

---

## Part 9: AI Context & Structured Outputs

**Objective:** Enhance AI integration to accept board state + user query + conversation history. AI returns structured outputs with task updates.

### Substeps
- [ ] Define Structured Output schema (user_response, board_updates)
  - board_updates: array of {action: 'add'|'edit'|'delete'|'move', card, column_id, position}
- [ ] Create POST /api/ai/chat endpoint
  - Accept: { user_message, board_state, conversation_history }
  - Return: { user_response, board_updates }
- [ ] Implement prompt engineering to include board context
- [ ] Implement system prompt guiding AI to suggest/make board changes
- [ ] Add conversation history tracking (store in ai_messages table)
- [ ] Process AI structured outputs and apply board changes atomically
- [ ] Write pytest tests: verify structured output parsing
- [ ] Write pytest tests: verify board changes apply correctly
- [ ] Test multi-step interactions (e.g., "create 3 cards", then "move to done")

### Tests & Success Criteria
- /api/ai/chat accepts board state and user query
- AI returns structured JSON with user_response and board_updates
- Board updates are applied correctly and atomically
- Conversation history persists
- Tests: >80% coverage of AI integration
- Test multi-step AI interactions work correctly

---

## Part 10: AI Chat Sidebar & UI Integration

**Objective:** Add beautiful AI chat sidebar to frontend. AI can create/edit/move cards via chat. UI updates in real-time.

### Substeps
- [ ] Create ChatSidebar component (message list + input box)
- [ ] Create Message component (role: user/assistant, formatted text)
- [ ] Implement send message handler:
  - Call /api/ai/chat with current board state + message
  - Display AI response in chat
  - Apply board_updates from AI response
- [ ] Update KanbanBoard to listen for board updates from AI
- [ ] Implement real-time UI sync: when AI updates cards, UI refreshes immediately
- [ ] Add markdown support to AI responses (use react-markdown)
- [ ] Add typing indicator while waiting for AI response
- [ ] Implement conversation history in sidebar (session-based)
- [ ] Add clear chat button
- [ ] Style sidebar: match color scheme (blue, yellow, purple, navy)
- [ ] Write Vitest tests: ChatSidebar component, message rendering
- [ ] Write Playwright e2e tests: full chat flow with AI board changes
- [ ] Test edge cases: rapid fire messages, board state during AI response

### Tests & Success Criteria
- ChatSidebar renders correctly
- User can type and send messages
- AI responses appear in chat
- Board updates from AI appear immediately in Kanban
- Typing indicator shows while AI responds
- Chat history persists (within session)
- E2E test: send message → AI creates card → card appears in Kanban
- Tests: >80% coverage of chat components

---

## Success Metrics

- All 10 parts completed and tested
- Frontend: >80% unit test coverage, E2E tests for critical flows
- Backend: >80% unit test coverage, E2E integration tests
- Dockerized app runs locally without issues
- MVP features working: login → Kanban → AI chat → board updates

## Notes

- For MVP, only one user ("user" / "password") and one board per user
- No database migrations framework needed; schema created on startup
- Use optimistic UI updates for better UX
- Keep AI prompts simple and focused on board operations
- Plan for future: multi-user support, multiple boards per user, collaborative editing