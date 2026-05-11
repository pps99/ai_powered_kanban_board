"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { ChatSidebar } from "@/components/ChatSidebar";
import { moveCard, type BoardData } from "@/lib/kanban";
import { useAuth } from "@/contexts/auth";
import { api, type BoardResponse } from "@/lib/api";

const emptyBoard: BoardData = { columns: [], cards: {} };

export const KanbanBoard = () => {
  const { logout, boardId } = useAuth();
  const [board, setBoard] = useState<BoardData>(emptyBoard);
  const [boardResponse, setBoardResponse] = useState<BoardResponse | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const loadBoard = useCallback(async () => {
    if (!boardId) return;
    try {
      const data = await api.getBoard(boardId);
      setBoard({ columns: data.columns, cards: data.cards });
      setBoardResponse(data);
    } catch {
      showError("Failed to load board.");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const cardsById = useMemo(() => board.cards, [board.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id) return;

    const newColumns = moveCard(board.columns, active.id as string, over.id as string);
    setBoard((prev) => ({ ...prev, columns: newColumns }));

    // Determine new column and position for the API
    const newCol = newColumns.find((c) => c.cardIds.includes(active.id as string));
    if (newCol && boardId) {
      const position = newCol.cardIds.indexOf(active.id as string);
      api.updateCard(boardId, active.id as string, { column_id: newCol.id, position })
        .catch(() => {
          showError("Failed to save card move.");
          loadBoard();
        });
    }
  };

  const handleRenameColumn = async (columnId: string, title: string) => {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((c) => c.id === columnId ? { ...c, title } : c),
    }));
    if (!boardId) return;
    try {
      await api.updateColumn(boardId, columnId, title);
    } catch {
      showError("Failed to rename column.");
      loadBoard();
    }
  };

  const handleAddCard = async (columnId: string, title: string, details: string) => {
    if (!boardId) return;
    try {
      const card = await api.addCard(boardId, columnId, title, details || "");
      setBoard((prev) => ({
        cards: { ...prev.cards, [card.id]: card },
        columns: prev.columns.map((c) =>
          c.id === columnId ? { ...c, cardIds: [...c.cardIds, card.id] } : c
        ),
      }));
    } catch {
      showError("Failed to add card.");
    }
  };

  const handleDeleteCard = async (columnId: string, cardId: string) => {
    // Optimistic
    setBoard((prev) => ({
      cards: Object.fromEntries(Object.entries(prev.cards).filter(([id]) => id !== cardId)),
      columns: prev.columns.map((c) =>
        c.id === columnId ? { ...c, cardIds: c.cardIds.filter((id) => id !== cardId) } : c
      ),
    }));
    if (!boardId) return;
    try {
      await api.deleteCard(boardId, cardId);
    } catch {
      showError("Failed to delete card.");
      loadBoard();
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      {error && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-6 py-3 text-sm font-semibold text-red-700 shadow-lg">
          {error}
        </div>
      )}

      <main className="relative mx-auto flex min-h-screen max-w-[1700px] gap-6 px-6 pb-16 pt-12">
        <div className="flex flex-1 flex-col gap-10 min-w-0">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
              >
                Sign out
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-24 text-sm text-[var(--gray-text)]">
            Loading board...
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
        </div>

        {!loading && boardResponse && (
          <div className="w-80 shrink-0 py-0 sticky top-12 h-[calc(100vh-6rem)]">
            <ChatSidebar board={boardResponse} onBoardUpdate={loadBoard} />
          </div>
        )}
      </main>
    </div>
  );
};
