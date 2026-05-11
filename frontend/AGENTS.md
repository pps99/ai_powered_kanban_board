# Frontend Architecture & Codebase

## Overview

This is a NextJS 16 / React 19 frontend for a Kanban board MVP. The app currently runs as a standalone demo with in-memory state management (no backend integration yet). All components use TypeScript and follow functional component patterns with React hooks.

**Current Status:** Frontend-only demo with drag-and-drop Kanban board

**Key Libraries:**
- **@dnd-kit/core** - Drag and drop functionality
- **@dnd-kit/sortable** - Sortable list utilities
- **Tailwind CSS 4** - Styling
- **Vitest** - Unit testing
- **Playwright** - E2E testing

---

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with global styles
│   │   └── page.tsx            # Home page (renders KanbanBoard)
│   ├── components/
│   │   ├── KanbanBoard.tsx      # Main board orchestrator (state management)
│   │   ├── KanbanColumn.tsx     # Column component with drag zone
│   │   ├── KanbanCard.tsx       # Individual card (draggable)
│   │   ├── KanbanCardPreview.tsx # Card preview during drag
│   │   ├── NewCardForm.tsx      # Inline form to add new cards
│   │   └── KanbanBoard.test.tsx # Integration tests
│   ├── lib/
│   │   ├── kanban.ts           # Core logic (types, state logic)
│   │   └── kanban.test.ts      # Unit tests for kanban logic
│   └── test/
│       ├── setup.ts            # Vitest setup (globals, testing library config)
│       └── vitest.d.ts         # TypeScript definitions for test utils
├── public/                      # Static assets
├── tests/                       # Playwright E2E tests (directory)
├── package.json
├── next.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── tsconfig.json
```

---

## Key Components

### KanbanBoard (`src/components/KanbanBoard.tsx`)

**Purpose:** Main orchestrator component. Manages board state and handles all card/column operations.

**State:**
- `board`: BoardData (columns + cards)
- `activeCardId`: Currently dragged card ID (for overlay)

**Key Handlers:**
- `handleDragStart()` - Sets active card for drag overlay
- `handleDragEnd()` - Calls moveCard() to reorder, updates state
- `handleRenameColumn()` - Updates column title
- `handleAddCard()` - Creates new card with ID, adds to column
- `handleDeleteCard()` - Removes card from board and column

**Drag & Drop:**
- Uses DndContext from @dnd-kit/core
- PointerSensor with 6px activation distance
- closestCorners collision detection
- DragOverlay shows preview of dragged card

---

### KanbanColumn (`src/components/KanbanColumn.tsx`)

**Purpose:** Renders a single column with cards and controls.

**Props:**
- `column` - Column object (id, title, cardIds)
- `cards` - Array of Card objects in column
- `onRename()` - Callback to rename column
- `onAddCard()` - Callback to add new card
- `onDeleteCard()` - Callback to delete card

**Features:**
- Drag zone for cards (droppable)
- Rename button/input toggle
- "Add Card" button
- Card list with NewCardForm overlay

---

### KanbanCard (`src/components/KanbanCard.tsx`)

**Purpose:** Individual card component (draggable).

**Props:**
- `card` - Card object (id, title, details)
- `columnId` - Parent column ID (for delete callback)
- `onDelete()` - Delete callback

**Features:**
- Draggable element
- Card title and details
- Delete button

---

### KanbanCardPreview (`src/components/KanbanCardPreview.tsx`)

**Purpose:** Visual preview of card during drag (shown in DragOverlay).

**Props:**
- `card` - Card being dragged

---

### NewCardForm (`src/components/NewCardForm.tsx`)

**Purpose:** Inline form for adding new cards.

**Props:**
- `onAddCard()` - Callback with (columnId, title, details)
- `onCancel()` - Callback to close form

---

## Core Logic

### `src/lib/kanban.ts`

**Types:**
```typescript
type Card = { id, title, details }
type Column = { id, title, cardIds[] }
type BoardData = { columns[], cards{} }
```

**Functions:**

#### `initialData`
Hardcoded starter board with 5 columns and 8 cards for demo purposes.

#### `moveCard(columns, activeId, overId)`
Core reordering logic. Handles:
- Moving card within same column (reordering)
- Moving card between columns
- Column-to-column moves maintain position

Returns new columns array with updated cardIds.

#### `createId(prefix)`
Generates unique IDs: `{prefix}-{randomPart}{timePart}`
- Used for new cards and columns
- Not cryptographically secure (demo only)

---

## Styling

**Approach:** Tailwind CSS 4 with CSS custom properties for colors.

**CSS Variables (defined in layout.tsx):**
```css
--primary-blue: #209dd7
--secondary-purple: #753991
--accent-yellow: #ecad0a
--navy-dark: #032147
--gray-text: #888888
--stroke: rgba(0, 0, 0, 0.08)
--surface: #f5f5f5
--shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
```

**Key Classes:**
- `font-display` - Custom header font via @tailwindcss/postcss
- Radial gradient backgrounds for visual polish
- Backdrop blur effects

---

## Testing

### Unit Tests (`src/lib/kanban.test.ts`)

Tests for kanban logic:
- `moveCard()` within column
- `moveCard()` between columns
- `createId()` uniqueness

### Integration Tests (`src/components/KanbanBoard.test.tsx`)

Tests for component interactions:
- Drag and drop operations
- Column rename
- Card add/delete

### E2E Tests (`tests/`)

Uses Playwright:
- Full user flows (drag, rename, add, delete)
- Visual regression (optional)

---

## Current Limitations

1. **In-memory state only** - No persistence across page reload
2. **Single user** - No authentication
3. **Single board** - No board switching
4. **Hardcoded data** - initialData only
5. **No backend** - Runs standalone

---

## Future Integrations (Roadmap)

**Part 3:** Static build output for backend serving
**Part 4:** Add LoginPage component + auth context
**Part 7:** Replace initialData with API calls
**Part 10:** Add ChatSidebar component for AI integration

---

## Development Commands

```bash
npm install              # Install dependencies
npm run dev              # Start Next dev server (http://localhost:3000)
npm run build            # Build static export (output: out/)
npm run test:unit        # Run Vitest
npm run test:unit:watch  # Run Vitest in watch mode
npm run test:e2e         # Run Playwright tests
npm run test:all         # Run all tests
npm run lint             # Run ESLint
```

---

## Notes for Integration

When integrating with backend:

1. **Remove initialData** - Replace with API fetch in KanbanBoard.useEffect
2. **Add API wrapper** - Create lib/api.ts with fetch helpers (JWT headers)
3. **Add Auth context** - Create contexts/auth.tsx for login state
4. **Update KanbanBoard** - Add useEffect to fetch /api/boards/{id}
5. **Update handlers** - Modify handlers to call API endpoints
6. **Error handling** - Add error boundaries and error toasts
7. **Loading states** - Add loading indicators during API calls
8. **Optimistic updates** - Update UI immediately, sync with server
