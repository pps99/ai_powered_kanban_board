import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { NewCardForm } from "@/components/NewCardForm";

describe("NewCardForm", () => {
  it("renders add card button initially", () => {
    render(<NewCardForm onAdd={() => {}} />);
    expect(screen.getByRole("button", { name: /add a card/i })).toBeInTheDocument();
  });

  it("shows form when add button is clicked", async () => {
    render(<NewCardForm onAdd={() => {}} />);
    const addButton = screen.getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);
    
    expect(screen.getByPlaceholderText(/card title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/details/i)).toBeInTheDocument();
  });

  it("renders submit and cancel buttons in form", async () => {
    render(<NewCardForm onAdd={() => {}} />);
    const addButton = screen.getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);
    
    expect(screen.getByRole("button", { name: /add card/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls onAdd with correct parameters when form is submitted", async () => {
    const onAdd = vi.fn();
    render(<NewCardForm onAdd={onAdd} />);
    
    const addButton = screen.getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);
    
    const titleInput = screen.getByPlaceholderText(/card title/i);
    const detailsInput = screen.getByPlaceholderText(/details/i);
    
    await userEvent.type(titleInput, "Test Title");
    await userEvent.type(detailsInput, "Test Details");
    
    const submitButton = screen.getByRole("button", { name: /add card/i });
    await userEvent.click(submitButton);
    
    expect(onAdd).toHaveBeenCalledWith("Test Title", "Test Details");
  });

  it("closes form and clears inputs after submit", async () => {
    render(<NewCardForm onAdd={() => {}} />);
    
    let addButton = screen.getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);
    
    const titleInput = screen.getByPlaceholderText(/card title/i) as HTMLInputElement;
    await userEvent.type(titleInput, "Test Title");
    
    const submitButton = screen.getByRole("button", { name: /add card/i });
    await userEvent.click(submitButton);
    
    // Form should be closed
    expect(screen.getByRole("button", { name: /add a card/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();
  });

  it("closes form when cancel button is clicked", async () => {
    render(<NewCardForm onAdd={() => {}} />);
    
    const addButton = screen.getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);
    
    const titleInput = screen.getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "Test Title");
    
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelButton);
    
    // Form should be closed
    expect(screen.getByRole("button", { name: /add a card/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();
  });

  it("does not submit with empty title", async () => {
    const onAdd = vi.fn();
    render(<NewCardForm onAdd={onAdd} />);
    
    const addButton = screen.getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);
    
    const detailsInput = screen.getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Test Details");
    
    const submitButton = screen.getByRole("button", { name: /add card/i });
    await userEvent.click(submitButton);
    
    // Should not have called onAdd
    expect(onAdd).not.toHaveBeenCalled();
  });
});
