import { render, screen } from "@testing-library/react";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";

const mockCard = {
  id: "card-1",
  title: "Test Card",
  details: "Test Details",
};

describe("KanbanCardPreview", () => {
  it("renders card preview with title", () => {
    render(<KanbanCardPreview card={mockCard} />);
    expect(screen.getByText("Test Card")).toBeInTheDocument();
  });

  it("renders card preview with details", () => {
    render(<KanbanCardPreview card={mockCard} />);
    expect(screen.getByText("Test Details")).toBeInTheDocument();
  });

  it("displays long titles without truncation", () => {
    const longCard = {
      id: "card-1",
      title: "This is a very long card title that goes on and on",
      details: "Short details",
    };
    render(<KanbanCardPreview card={longCard} />);
    expect(screen.getByText("This is a very long card title that goes on and on")).toBeInTheDocument();
  });

  it("displays long details without truncation", () => {
    const detailsCard = {
      id: "card-1",
      title: "Title",
      details: "This is a very long details field with a lot of information about what needs to be done",
    };
    render(<KanbanCardPreview card={detailsCard} />);
    expect(screen.getByText("This is a very long details field with a lot of information about what needs to be done")).toBeInTheDocument();
  });
});
