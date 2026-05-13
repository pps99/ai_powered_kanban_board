# Code Review

Reviewed on 2026-05-12. Thorough review of frontend, backend, Docker, and documentation.

---

## Overall Assessment

The project is well-structured and functional. The implementation covers all 10 parts of the PLAN.md. Core functionality works: auth, Kanban CRUD, drag-and-drop, AI chat. Key areas that need attention are security, testing coverage, and some architectural gaps.

---

## Critical Issues

### 1. Password hashing is SHA-256 with no salt (`init_db.py:25`)

```python
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()
```

SHA-256 without a salt is trivial to brute-force. Use `bcrypt` or `argon2`. Since the plan states no additional dependencies, at minimum use `secrets.compare_digest` for timing-safe comparison in the login check, and store a unique salt per user.

### 2. CORS allows all origins (`main.py:23-29`)

```python
allow_origins=["*"]
```

This is fine for a local-only MVP but should be documented. For any non-localhost deployment, restrict to known origins.

### 3. JWT secret defaults to a hardcoded string (`dependencies.py:11`)

```python
SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-please-change-in-production!!")
```

If `.env` is missing or `JWT_SECRET` is unset, the fallback is a known string. Either fail fast (raise if not set in production) or generate a random key on first start and persist it.

### 4. SQL injection is mitigated but `dict` access is unsafe (`routers/boards.py:111`)

```python
card = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
...
new_col = int(body.column_id) if body.column_id is not None else card["column_id"]
```

If `card` is `None` at line 111, the code reaches `card["column_id"]` and raises a `TypeError` — not a security issue but poor error handling. The surrounding try/except does not cover this. The `HTTPException` at line 113 is unreachable in this case. Similar pattern in `_apply_board_updates` at `routers/ai.py:137-141`.

### 5. No cleanup on logout (`routers/auth.py:42-43`)

```python
@router.post("/logout")
def logout(_uid: Annotated[int, Depends(current_user_id)]):
    return {"ok": True}
```

The logout endpoint validates the token but does not delete the session from the `sessions` table. The `sessions` table exists in the schema but is never written to or read from — only JWTs are used. The sessions table should either be removed or the logout should clean it up.

---

## Significant Issues

### 6. No connection pooling (`init_db.py:16-21`)

```python
def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
```

Every API call opens a new connection. FastAPI runs synchronously in this setup so it's not a blocking issue, but it is inefficient. Wrap with a module-level singleton or use `aiosqlite` + async routes if async is desired.

### 7. Tests only cover happy paths (`test_api.py`)

All tests pass with valid input. Missing:
- Invalid JSON body
- Malformed tokens
- Board not found for non-owner
- Column not found on rename
- Concurrent card creation (position calculation)

### 8. No test coverage metrics

PLAN.md specifies ">80% coverage" but no coverage tool is configured. `vitest coverage-v8` is installed but not wired to any npm script.

### 9. `initialData` dead code in `kanban.ts`

The `initialData` constant and `createId` function are no longer used (backend generates IDs). They remain in `src/lib/kanban.ts:18-72` and `kanban.ts:164-168`. Remove to avoid confusion.

### 10. E2E tests directory is empty

`frontend/tests/` exists but has no test files. Playwright is configured but not utilized.

### 11. Backend AGENTS.md is a stub (`backend/AGENTS.md`)

The file contains only `"This file should be updated"`. Frontend AGENTS.md is well-documented but backend documentation is missing.

### 12. No type safety on AI structured output parsing (`routers/ai.py:99`)

```python
updates = [BoardUpdate(**u) for u in updates_raw if isinstance(u, dict)]
```

If the AI returns an unexpected shape (e.g., `{"action": "invalid", "extra": "field"}`), this silently drops updates. The system prompt constrains behavior but there is no validation. Consider logging unparseable updates for debugging.

### 13. Chat history grows without limit (`routers/ai.py:79`)

```python
history = body.conversation_history[-10:]
```

Only 10 messages are sent to the AI, but the `ai_messages` table grows indefinitely. For MVP this is fine, but it should be documented. A cleanup mechanism (e.g., keep last N messages) would be appropriate for a larger scale.

---

## Minor Issues

### 14. Column rename debounce missing

`KanbanColumn.tsx:44` fires `onRename` on every keystroke. No debouncing means every keystroke triggers an API call. A debounce of 500ms would reduce backend load.

### 15. Error messages are user-friendly but not localized

All error messages are in English. Fine for MVP.

### 16. `.env` is not in `.gitignore`

The `.env` file (which contains `OPENROUTER_API_KEY`) should be in `.gitignore`. Currently it appears it may be tracked.

### 17. No logging in backend

No `logging` module usage anywhere in the backend. For debugging AI responses and API errors, structured logging would help.

### 18. `loadBoard` has no deduplication on concurrent calls

If `loadBoard` is called multiple times rapidly (e.g., error recovery), there is no deduplication. A `useRef` flag or request tracking would prevent race conditions.

### 19. Static export + `useEffect` client component works but is unconventional

`frontend/src/app/page.tsx` is a `"use client"` component that exports a default function. In Next.js App Router, page components are server components by default. Using `"use client"` here is valid but the `AuthProvider` context needs client-side rendering. This pattern works correctly but could be clarified with an explicit `dynamic` import or by splitting into a server page that wraps a client component.

### 20. Scripts have inconsistent naming

- `start-linux.sh`, `start-mac.sh`, `start-pc.cmd` vs `stop-linux.sh`, etc.
- The `started` file in scripts/ appears to be a lock/PID file but is not used by the stop scripts.

---

## What's Working Well

- **Architecture**: Clean separation between frontend (Next.js static export) and backend (FastAPI). The Docker multi-stage build is correct.
- **Drag and drop**: `@dnd-kit` integration is solid. PointerSensor with 6px activation distance prevents accidental drags.
- **Optimistic UI**: Card delete updates local state immediately, then syncs with server.
- **Auth context**: Clean implementation with localStorage persistence and proper `useAuth` hook.
- **API layer**: Well-typed `api` object in `frontend/src/lib/api.ts` with consistent error handling.
- **Board schema**: SQLite with foreign keys enforced via `PRAGMA foreign_keys = ON`. The ERD in `DATABASE.md` matches the implementation.
- **AI integration**: System prompt approach is sound. The fallback on JSON parse failure (`routers/ai.py:91-94`) handles model non-compliance gracefully.
- **Tests**: Backend tests cover core CRUD flows. Frontend component tests with mocked API are well-structured.
- **Styling**: Tailwind CSS 4 with CSS variables for the color scheme. Consistent visual language.

---

## Recommendations (Priority Order)

1. Fix password hashing — use bcrypt or at minimum add per-user salt
2. Remove or utilize the `sessions` table
3. Add debounce to column rename
4. Fix error handling gaps in `routers/boards.py` (card["column_id"] on None)
5. Add `vitest coverage` to npm test script
6. Remove dead `initialData` code from `kanban.ts`
7. Add E2E tests or remove Playwright dependency
8. Add `.env` to `.gitignore`
9. Document backend in `backend/AGENTS.md`
10. Add basic logging to backend