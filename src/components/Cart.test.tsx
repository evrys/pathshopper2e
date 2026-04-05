// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartEntry } from "../hooks/useCart";
import type { Item } from "../types";
import { Cart } from "./Cart";

afterEach(cleanup);

// tippy.js doesn't work in jsdom
vi.mock("tippy.js", () => ({
  default: () => ({ destroy: () => {} }),
}));
vi.mock("tippy.js/dist/tippy.css", () => ({}));

// Stub matchMedia for useMediaQuery (desktop by default)
vi.stubGlobal(
  "matchMedia",
  vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
);

// Stub import.meta.env.BASE_URL
vi.stubGlobal("__COMMIT_HASH__", "test123");

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "w1",
    name: "Longsword",
    type: "weapon",
    level: 1,
    price: { gp: 1 },
    category: "Base Weapons",
    traits: [],
    rarity: "common",
    bulk: 1,
    usage: "held in 1 hand",
    source: "Core Rulebook",
    remaster: true,
    description: "",
    plainDescription: "",
    ...overrides,
  };
}

function makeEntry(overrides: Partial<CartEntry> = {}): CartEntry {
  return {
    item: makeItem(),
    quantity: 1,
    ...overrides,
  };
}

const defaultProps = {
  entries: [] as CartEntry[],
  totalPrice: {},
  listName: "My List",
  lists: [],
  activeListId: "list-1",
  onListNameChange: vi.fn(),
  onSetQuantity: vi.fn(),
  onRemoveItem: vi.fn(),
  onSetPriceModifier: vi.fn(),
  onSetNotes: vi.fn(),
  onAddItem: vi.fn(),
  onLoadList: vi.fn(),
  onNewList: vi.fn(),
  onDeleteList: vi.fn(),
  onImportCsv: vi.fn().mockReturnValue(0),
};

describe("Cart", () => {
  it("renders the list name", () => {
    render(<Cart {...defaultProps} />);
    expect(screen.getByText("My List")).toBeDefined();
  });

  it("shows empty state when cart is empty", () => {
    render(<Cart {...defaultProps} />);
    expect(
      screen.getByText("Add items from the table to start building your list."),
    ).toBeDefined();
  });

  it("renders cart entries", () => {
    const entries = [
      makeEntry({ item: makeItem({ id: "w1", name: "Longsword" }) }),
      makeEntry({
        item: makeItem({ id: "w2", name: "Shortsword" }),
        quantity: 3,
      }),
    ];
    render(<Cart {...defaultProps} entries={entries} />);

    expect(screen.getByText("Longsword")).toBeDefined();
    expect(screen.getByText("Shortsword")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("calls onSetQuantity when + is clicked", () => {
    const onSetQuantity = vi.fn();
    const entries = [makeEntry()];
    render(
      <Cart
        {...defaultProps}
        entries={entries}
        onSetQuantity={onSetQuantity}
      />,
    );

    // Find the + button (add quantity)
    const plusBtns = screen.getAllByText("+");
    // The last + button in the controls (the first one might be the table add btn)
    fireEvent.click(plusBtns[0]);
    expect(onSetQuantity).toHaveBeenCalledWith("w1", 2);
  });

  it("calls onSetQuantity when − is clicked", () => {
    const onSetQuantity = vi.fn();
    const entries = [makeEntry({ quantity: 3 })];
    render(
      <Cart
        {...defaultProps}
        entries={entries}
        onSetQuantity={onSetQuantity}
      />,
    );

    fireEvent.click(screen.getByText("−"));
    expect(onSetQuantity).toHaveBeenCalledWith("w1", 2);
  });

  it("calls onRemoveItem when ✕ remove button is clicked", () => {
    const onRemoveItem = vi.fn();
    const entries = [makeEntry()];
    render(
      <Cart {...defaultProps} entries={entries} onRemoveItem={onRemoveItem} />,
    );

    fireEvent.click(screen.getByTitle("Remove"));
    expect(onRemoveItem).toHaveBeenCalledWith("w1");
  });

  it("displays item price with discount", () => {
    const entries = [
      makeEntry({
        item: makeItem({ price: { gp: 10 } }),
        priceModifier: { type: "flat", cp: -200 },
      }),
    ];
    render(<Cart {...defaultProps} entries={entries} />);

    // Should show both original and discounted price
    expect(screen.getByText("10 gp")).toBeDefined();
    expect(screen.getByText("8 gp")).toBeDefined();
  });

  it("shows the total price when items exist", () => {
    const entries = [makeEntry()];
    render(<Cart {...defaultProps} entries={entries} totalPrice={{ gp: 5 }} />);

    expect(screen.getByText("Total:")).toBeDefined();
    expect(screen.getByText("5 gp")).toBeDefined();
  });

  it("shows Share link when entries exist", () => {
    const entries = [makeEntry()];
    render(<Cart {...defaultProps} entries={entries} />);
    expect(screen.getByText("Share")).toBeDefined();
  });

  it("does not show Share link when cart is empty", () => {
    render(<Cart {...defaultProps} />);
    expect(screen.queryByText("Share")).toBeNull();
  });

  it("opens the menu dropdown", () => {
    render(<Cart {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("List options"));

    expect(screen.getByText("Rename")).toBeDefined();
    expect(screen.getByText("Open list")).toBeDefined();
    expect(screen.getByText("New list")).toBeDefined();
    expect(screen.getByText("Add custom item")).toBeDefined();
  });

  it("renders custom items without link", () => {
    const entries = [
      makeEntry({
        item: makeItem({ id: "custom-1-123", name: "My Custom Item" }),
      }),
    ];
    render(<Cart {...defaultProps} entries={entries} />);

    const el = screen.getByText("My Custom Item");
    // custom items should be a span, not a link
    expect(el.tagName).toBe("SPAN");
  });

  it("shows settings button for each entry", () => {
    const entries = [makeEntry()];
    render(<Cart {...defaultProps} entries={entries} />);
    expect(screen.getByTitle("Item settings")).toBeDefined();
  });
});
