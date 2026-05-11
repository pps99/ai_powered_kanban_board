import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, describe, it, expect } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import { AuthProvider } from "@/contexts/auth";
import { api } from "@/lib/api";

const mockBoard = {
  id: 1,
  name: "Test Board",
  columns: [
    { id: "1", title: "Backlog", cardIds: ["1", "2"] },
    { id: "2", title: "Discovery", cardIds: ["3"] },
    { id: "3", title: "In Progress", cardIds: ["4", "5"] },
    { id: "4", title: "Review", cardIds: ["6"] },
    { id: "5", title: "Done", cardIds: ["7", "8"] },
  ],
  cards: {
    "1": { id: "1", title: "Align roadmap themes", details: "Draft quarterly themes." },
    "2": { id: "2", title: "Gather customer signals", details: "Review support tags." },
    "3": { id: "3", title: "Prototype analytics view", details: "Sketch layout." },
    "4": { id: "4", title: "Refine status language", details: "Standardize labels." },
    "5": { id: "5", title: "Design card layout", details: "Add hierarchy." },
    "6": { id: "6", title: "QA micro-interactions", details: "Verify hover states." },
    "7": { id: "7", title: "Ship marketing page", details: "Final copy approved." },
    "8": { id: "8", title: "Close onboarding sprint", details: "Document release notes." },
  },
};

vi.mock("@/lib/api", () => ({
  api: {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue({}),
    getBoard: vi.fn(),
    addCard: vi.fn(),
    updateCard: vi.fn().mockResolvedValue({}),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    updateColumn: vi.fn().mockResolvedValue({ id: "1", title: "New Name" }),
    sendChat: vi.fn(),
  },
}));

const renderBoard = () => {
  localStorage.setItem("pm_token", "test-token");
  localStorage.setItem("pm_board_id", "1");
  return render(
    <AuthProvider>
      <KanbanBoard />
    </AuthProvider>
  );
};

const waitForColumns = () =>
  waitFor(() => expect(screen.getAllByTestId(/column-/i).length).toBeGreaterThan(0));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
  vi.mocked(api.addCard).mockResolvedValue({ id: "99", title: "New card", details: "Notes" });
  vi.mocked(api.deleteCard).mockResolvedValue(undefined);
  vi.mocked(api.updateCard).mockResolvedValue({ id: "1", title: "Align roadmap themes", details: "" });
  vi.mocked(api.updateColumn).mockResolvedValue({ id: "1", title: "New Name" });
});

describe("KanbanBoard", () => {
  it("renders five columns after loading", async () => {
    renderBoard();
    await waitFor(() => expect(screen.getAllByTestId(/column-/i)).toHaveLength(5));
  });

  it("renders all columns with correct titles", async () => {
    renderBoard();
    await waitFor(() => expect(screen.getByText("Backlog")).toBeInTheDocument());
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders cards in columns", async () => {
    renderBoard();
    await waitFor(() =>
      expect(screen.getByText("Align roadmap themes")).toBeInTheDocument()
    );
    expect(screen.getByText("Prototype analytics view")).toBeInTheDocument();
    expect(screen.getByText("Ship marketing page")).toBeInTheDocument();
  });

  it("renames a column", async () => {
    renderBoard();
    await waitForColumns();
    const column = screen.getAllByTestId(/column-/i)[0];
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await userEvent.tab();
    expect(input).toHaveValue("New Name");
  });

  it("adds a card", async () => {
    renderBoard();
    await waitForColumns();
    const column = screen.getAllByTestId(/column-/i)[0];

    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    await waitFor(() =>
      expect(within(column).getByText("New card")).toBeInTheDocument()
    );
  });

  it("deletes a card", async () => {
    renderBoard();
    await waitFor(() =>
      expect(screen.getByText("Align roadmap themes")).toBeInTheDocument()
    );
    const column = screen.getAllByTestId(/column-/i)[0];
    await userEvent.click(
      within(column).getByRole("button", { name: /delete align roadmap themes/i })
    );
    await waitFor(() =>
      expect(within(column).queryByText("Align roadmap themes")).not.toBeInTheDocument()
    );
  });

  it("cancel button hides the add card form", async () => {
    renderBoard();
    await waitForColumns();
    const column = screen.getAllByTestId(/column-/i)[0];

    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    expect(within(column).getByPlaceholderText(/card title/i)).toBeInTheDocument();

    await userEvent.click(within(column).getByRole("button", { name: /cancel/i }));
    expect(within(column).queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();
  });
});
