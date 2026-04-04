// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddCustomItemModal } from "./AddCustomItemModal";

afterEach(cleanup);

describe("AddCustomItemModal", () => {
  it("renders the modal with title and form fields", () => {
    render(<AddCustomItemModal onAdd={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Add Custom Item")).toBeDefined();
    expect(screen.getByLabelText("Name")).toBeDefined();
    expect(screen.getByLabelText("Price")).toBeDefined();
  });

  it("disables the Add button when name is empty", () => {
    render(<AddCustomItemModal onAdd={() => {}} onClose={() => {}} />);
    const btn = screen.getByText("Add Item") as HTMLButtonElement;
    // empty name → still enabled since validation allows empty price but the name starts empty
    // The name starts empty, so Add should be disabled
    expect(btn.disabled).toBe(true);
  });

  it("enables the Add button when name is provided", () => {
    render(<AddCustomItemModal onAdd={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Magic Sword" },
    });
    const btn = screen.getByText("Add Item") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("calls onAdd with a custom item on submit", () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<AddCustomItemModal onAdd={onAdd} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Wand of Sparks" },
    });
    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "25" },
    });

    fireEvent.click(screen.getByText("Add Item"));

    expect(onAdd).toHaveBeenCalledOnce();
    const item = onAdd.mock.calls[0][0];
    expect(item.name).toBe("Wand of Sparks");
    expect(item.price).toEqual({ gp: 25 });
    expect(item.id).toMatch(/^custom-/);
    expect(item.category).toBe("Custom");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("creates an item with sp denomination", () => {
    const onAdd = vi.fn();
    render(<AddCustomItemModal onAdd={onAdd} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Torch" },
    });
    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Currency denomination"), {
      target: { value: "sp" },
    });

    fireEvent.click(screen.getByText("Add Item"));

    expect(onAdd.mock.calls[0][0].price).toEqual({ sp: 5 });
  });

  it("creates an item with empty price when amount is 0", () => {
    const onAdd = vi.fn();
    render(<AddCustomItemModal onAdd={onAdd} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Free Sample" },
    });

    fireEvent.click(screen.getByText("Add Item"));

    expect(onAdd.mock.calls[0][0].price).toEqual({});
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<AddCustomItemModal onAdd={() => {}} onClose={onClose} />);

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking the overlay background", () => {
    const onClose = vi.fn();
    render(<AddCustomItemModal onAdd={() => {}} onClose={onClose} />);

    const overlay = screen.getByRole("dialog");
    fireEvent.mouseDown(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<AddCustomItemModal onAdd={() => {}} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
