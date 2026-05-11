import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanCard } from "@/components/KanbanCard";
import { DndContext } from "@dnd-kit/core";

const mockCard = {
  id: "card-1",
  title: "Test Card",
  details: "Test Details",
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <DndContext>
    {children}
  </DndContext>
);

describe("KanbanCard", () => {
  it("renders card with title and details", () => {
    render(
      <Wrapper>
        <KanbanCard card={mockCard} onDelete={() => {}} />
      </Wrapper>
    );

    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Test Details")).toBeInTheDocument();
  });

  it("calls onDelete with cardId when delete button is clicked", async () => {
    const onDelete = vi.fn();
    render(
      <Wrapper>
        <KanbanCard card={mockCard} onDelete={onDelete} />
      </Wrapper>
    );

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await userEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith("card-1");
  });

  it("has correct data-testid attribute", () => {
    const { container } = render(
      <Wrapper>
        <KanbanCard card={mockCard} onDelete={() => {}} />
      </Wrapper>
    );

    const cardElement = container.querySelector('[data-testid="card-card-1"]');
    expect(cardElement).toBeInTheDocument();
  });
});
