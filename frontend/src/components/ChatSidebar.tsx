"use client";

import { useRef, useState, type FormEvent } from "react";
import { api, type BoardResponse, type ChatMessage } from "@/lib/api";
import { useAuth } from "@/contexts/auth";

type Props = {
  board: BoardResponse;
  onBoardUpdate: () => void;
};

export const ChatSidebar = ({ board, onBoardUpdate }: Props) => {
  const { boardId } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () =>
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || thinking || !boardId) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);
    setTimeout(scrollToBottom, 0);

    try {
      const res = await api.sendChat(boardId, text, board, messages);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.user_response },
      ]);
      if (res.board_updates.length > 0) onBoardUpdate();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setThinking(false);
      setTimeout(scrollToBottom, 0);
    }
  };

  const handleClear = () => setMessages([]);

  return (
    <aside className="flex h-full flex-col rounded-[32px] border border-[var(--stroke)] bg-white/80 shadow-[var(--shadow)] backdrop-blur">
      <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            AI Assistant
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-[var(--navy-dark)]">
            Board Chat
          </h2>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !thinking && (
          <p className="text-center text-sm text-[var(--gray-text)]">
            Ask me to create, move, or edit cards.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--secondary-purple)] px-4 py-3 text-sm text-white"
                  : "mr-auto max-w-[85%] rounded-2xl rounded-tl-sm border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--navy-dark)]"
              }
            >
              {msg.content}
            </div>
          ))}
          {thinking && (
            <div className="mr-auto rounded-2xl rounded-tl-sm border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--gray-text)]">
              <span className="animate-pulse">Thinking...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-3 border-t border-[var(--stroke)] px-6 py-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI to update the board..."
          disabled={thinking}
          className="flex-1 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-1 focus:ring-[var(--primary-blue)] disabled:opacity-60"
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={thinking || !input.trim()}
          className="rounded-xl bg-[var(--secondary-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
