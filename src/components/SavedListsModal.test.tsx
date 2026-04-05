// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedList } from "../hooks/useSavedLists";
import { SavedListsModal } from "./SavedListsModal";

afterEach(cleanup);

function makeList(overrides: Partial<SavedList> = {}): SavedList {
  return {
    id: "list-1",
    name: "Test List",
    items: {},
    savedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("SavedListsModal", () => {
  it("renders the modal title", () => {
    render(
      <SavedListsModal
        lists={[]}
        activeListId=""
        onLoad={() => {}}
        onDelete={() => {}}
        onNewList={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Saved Lists")).toBeDefined();
  });

  it("shows empty state when no lists exist", () => {
    render(
      <SavedListsModal
        lists={[]}
        activeListId=""
        onLoad={() => {}}
        onDelete={() => {}}
        onNewList={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("No saved lists yet.")).toBeDefined();
  });

  it("displays saved lists", () => {
    const lists = [
      makeList({ id: "a", name: "List A", items: { w1: 2 } }),
      makeList({ id: "b", name: "List B" }),
    ];
    render(
      <SavedListsModal
        lists={lists}
        activeListId="a"
        onLoad={() => {}}
        onDelete={() => {}}
        onNewList={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("List A")).toBeDefined();
    expect(screen.getByText("List B")).toBeDefined();
  });

  it("calls onLoad when a list is clicked", () => {
    const list = makeList({ id: "a", name: "My List" });
    const onLoad = vi.fn();
    render(
      <SavedListsModal
        lists={[list]}
        activeListId=""
        onLoad={onLoad}
        onDelete={() => {}}
        onNewList={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("My List"));
    expect(onLoad).toHaveBeenCalledWith(list);
  });

  it("shows the new list form when + New list is clicked", () => {
    render(
      <SavedListsModal
        lists={[makeList()]}
        activeListId="list-1"
        onLoad={() => {}}
        onDelete={() => {}}
        onNewList={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("+ New list"));
    expect(screen.getByPlaceholderText("List name")).toBeDefined();
    expect(screen.getByText("Create")).toBeDefined();
  });

  it("calls onNewList when a new list is created", () => {
    const onNewList = vi.fn();
    const onClose = vi.fn();
    render(
      <SavedListsModal
        lists={[]}
        activeListId=""
        onLoad={() => {}}
        onDelete={() => {}}
        onNewList={onNewList}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText("+ New list"));
    fireEvent.change(screen.getByPlaceholderText("List name"), {
      target: { value: "Campaign List" },
    });
    fireEvent.click(screen.getByText("Create"));

    expect(onNewList).toHaveBeenCalledWith("Campaign List", false);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the create form when initialCreatingNew is true", () => {
    render(
      <SavedListsModal
        lists={[]}
        activeListId=""
        initialCreatingNew
        onLoad={() => {}}
        onDelete={() => {}}
        onNewList={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByPlaceholderText("List name")).toBeDefined();
  });

  it("shows a delete confirmation dialog", () => {
    const list = makeList({ id: "a", name: "Doomed List" });
    render(
      <SavedListsModal
        lists={[list]}
        activeListId=""
        onLoad={() => {}}
        onDelete={() => {}}
        onNewList={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByLabelText('Delete "Doomed List"'));
    // Confirm dialog should appear with Delete/Cancel buttons
    // "Doomed List" appears in both the list and the confirmation
    expect(screen.getAllByText("Doomed List").length).toBeGreaterThanOrEqual(2);
    // The confirmation has its own Delete and Cancel buttons
    const deleteButtons = screen.getAllByText("Delete");
    expect(deleteButtons.length).toBe(1);
    expect(screen.getByText("Cancel")).toBeDefined();
  });
  it("calls onDelete after confirming delete", () => {
    const list = makeList({ id: "a", name: "Doomed List" });
    const onDelete = vi.fn();
    render(
      <SavedListsModal
        lists={[list]}
        activeListId=""
        onLoad={() => {}}
        onDelete={onDelete}
        onNewList={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByLabelText('Delete "Doomed List"'));
    fireEvent.click(screen.getByText("Delete"));

    expect(onDelete).toHaveBeenCalledWith("a");
  });

  it("calls onClose when pressing Escape", () => {
    const onClose = vi.fn();
    render(
      <SavedListsModal
        lists={[]}
        activeListId=""
        onLoad={() => {}}
        onDelete={() => {}}
        onNewList={() => {}}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <SavedListsModal
        lists={[]}
        activeListId=""
        onLoad={() => {}}
        onDelete={() => {}}
        onNewList={() => {}}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
