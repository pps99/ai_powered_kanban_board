import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, describe, it, expect } from "vitest";
import { ChatSidebar } from "@/components/ChatSidebar";
import { AuthProvider } from "@/contexts/auth";
import { api } from "@/lib/api";

const mockBoard = {
  id: 1,
  name: "Test",
  columns: [{ id: "1", title: "Backlog", cardIds: [] }],
  cards: {},
};

vi.mock("@/lib/api", () => ({
  api: {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue({}),
    getBoard: vi.fn(),
    addCard: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
    updateColumn: vi.fn(),
    sendChat: vi.fn(),
  },
}));

const renderSidebar = (onBoardUpdate = vi.fn()) => {
  localStorage.setItem("pm_token", "test");
  localStorage.setItem("pm_board_id", "1");
  return render(
    <AuthProvider>
      <ChatSidebar board={mockBoard} onBoardUpdate={onBoardUpdate} />
    </AuthProvider>
  );
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("ChatSidebar", () => {
  it("renders chat input and send button", () => {
    renderSidebar();
    expect(screen.getByLabelText(/chat message/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("shows placeholder message when empty", () => {
    renderSidebar();
    expect(screen.getByText(/ask me to create/i)).toBeInTheDocument();
  });

  it("sends a message and shows response", async () => {
    vi.mocked(api.sendChat).mockResolvedValue({
      user_response: "I added a card!",
      board_updates: [],
    });

    renderSidebar();
    const input = screen.getByLabelText(/chat message/i);
    await userEvent.type(input, "Add a card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText("I added a card!")).toBeInTheDocument()
    );
    expect(screen.getByText("Add a card")).toBeInTheDocument();
  });

  it("calls onBoardUpdate when board_updates returned", async () => {
    const onBoardUpdate = vi.fn();
    vi.mocked(api.sendChat).mockResolvedValue({
      user_response: "Done!",
      board_updates: [{ action: "add", column_id: "1", title: "New" }],
    });

    renderSidebar(onBoardUpdate);
    const input = screen.getByLabelText(/chat message/i);
    await userEvent.type(input, "Add a task");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(onBoardUpdate).toHaveBeenCalled());
  });

  it("shows error message on API failure", async () => {
    vi.mocked(api.sendChat).mockRejectedValue(new Error("Network error"));

    renderSidebar();
    await userEvent.type(screen.getByLabelText(/chat message/i), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    );
  });

  it("clears chat when clear button clicked", async () => {
    vi.mocked(api.sendChat).mockResolvedValue({
      user_response: "Hello!",
      board_updates: [],
    });

    renderSidebar();
    await userEvent.type(screen.getByLabelText(/chat message/i), "Hi");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(screen.getByText("Hello!")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(screen.queryByText("Hello!")).not.toBeInTheDocument();
  });
});
