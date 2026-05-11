import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanColumn } from "@/components/KanbanColumn";
import { DndContext } from "@dnd-kit/core";

const mockColumn = {
  id: "col-1",
  title: "Test Column",
  cardIds: ["card-1"],
};

const mockCards = [
  { id: "card-1", title: "Card 1", details: "Details 1" },
];

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <DndContext>
    {children}
  </DndContext>
);

describe("KanbanColumn", () => {
  it("renders column with title", () => {
    render(
      <Wrapper>
        <KanbanColumn
          column={mockColumn}
          cards={mockCards}
          onRename={() => {}}
          onAddCard={() => {}}
          onDeleteCard={() => {}}
        />
      </Wrapper>
    );
    
    expect(screen.getByDisplayValue("Test Column")).toBeInTheDocument();
  });

  it("renders cards in column", () => {
    render(
      <Wrapper>
        <KanbanColumn
          column={mockColumn}
          cards={mockCards}
          onRename={() => {}}
          onAddCard={() => {}}
          onDeleteCard={() => {}}
        />
      </Wrapper>
    );
    
    expect(screen.getByText("Card 1")).toBeInTheDocument();
    expect(screen.getByText("Details 1")).toBeInTheDocument();
  });

  it("shows add card form when button clicked", async () => {
    render(
      <Wrapper>
        <KanbanColumn
          column={mockColumn}
          cards={mockCards}
          onRename={() => {}}
          onAddCard={() => {}}
          onDeleteCard={() => {}}
        />
      </Wrapper>
    );
    
    const addButton = screen.getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);
    
    expect(screen.getByPlaceholderText(/card title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/details/i)).toBeInTheDocument();
  });

  it("calls onAddCard with correct parameters", async () => {
    const onAddCard = vi.fn();
    render(
      <Wrapper>
        <KanbanColumn
          column={mockColumn}
          cards={mockCards}
          onRename={() => {}}
          onAddCard={onAddCard}
          onDeleteCard={() => {}}
        />
      </Wrapper>
    );
    
    const addButton = screen.getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);
    
    const titleInput = screen.getByPlaceholderText(/card title/i);
    const detailsInput = screen.getByPlaceholderText(/details/i);
    
    await userEvent.type(titleInput, "New Card");
    await userEvent.type(detailsInput, "New Details");
    
    const submitButton = screen.getByRole("button", { name: /add card/i });
    await userEvent.click(submitButton);
    
    expect(onAddCard).toHaveBeenCalledWith("col-1", "New Card", "New Details");
  });

  it("renders empty column correctly", () => {
    render(
      <Wrapper>
        <KanbanColumn
          column={{ ...mockColumn, cardIds: [] }}
          cards={[]}
          onRename={() => {}}
          onAddCard={() => {}}
          onDeleteCard={() => {}}
        />
      </Wrapper>
    );
    
    expect(screen.getByDisplayValue("Test Column")).toBeInTheDocument();
    expect(screen.queryByText("Card 1")).not.toBeInTheDocument();
  });
});
