const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("pm_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; board_id: number }>("POST", "/auth/login", { username, password }),

  logout: () => request<void>("POST", "/auth/logout"),

  getBoard: (boardId: number) =>
    request<BoardResponse>("GET", `/boards/${boardId}`),

  addCard: (boardId: number, columnId: string, title: string, details: string) =>
    request<{ id: string; title: string; details: string }>("POST", `/boards/${boardId}/cards`, {
      column_id: columnId,
      title,
      details,
    }),

  updateCard: (boardId: number, cardId: string, data: { title?: string; details?: string; column_id?: string; position?: number }) =>
    request<{ id: string; title: string; details: string }>("PUT", `/boards/${boardId}/cards/${cardId}`, data),

  deleteCard: (boardId: number, cardId: string) =>
    request<void>("DELETE", `/boards/${boardId}/cards/${cardId}`),

  updateColumn: (boardId: number, columnId: string, title: string) =>
    request<{ id: string; title: string }>("PUT", `/boards/${boardId}/columns/${columnId}`, { title }),

  sendChat: (boardId: number, message: string, boardState: BoardResponse, history: ChatMessage[]) =>
    request<{ user_response: string; board_updates: BoardUpdate[] }>("POST", `/ai/chat`, {
      board_id: boardId,
      user_message: message,
      board_state: boardState,
      conversation_history: history,
    }),
};

export type BoardResponse = {
  id: number;
  name: string;
  columns: { id: string; title: string; cardIds: string[] }[];
  cards: Record<string, { id: string; title: string; details: string }>;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type BoardUpdate = {
  action: "add" | "edit" | "delete" | "move";
  card_id?: string;
  column_id?: string;
  position?: number;
  title?: string;
  details?: string;
};
