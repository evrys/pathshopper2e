// @vitest-environment jsdom
import * as Tooltip from "@radix-ui/react-tooltip";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartEntry } from "../hooks/useCart";
import type { Item } from "../types";
import { Cart } from "./Cart";

afterEach(cleanup);

function renderWithProviders(ui: React.ReactElement) {
  return render(<Tooltip.Provider>{ui}</Tooltip.Provider>);
}

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
  allItems: [] as CartEntry["item"][],
  listName: "My List",
  lists: [],
  activeListId: "list-1",
  onListNameChange: vi.fn(),
  onSetQuantity: vi.fn(),
  onRemoveItem: vi.fn(),
  onSetPriceModifier: vi.fn(),
  onSetNotes: vi.fn(),
  onUpdateItem: vi.fn(),
  onAddItem: vi.fn(),
  onLoadList: vi.fn(),
  onNewList: vi.fn(),
  onDeleteList: vi.fn(),
  onImportCsv: vi.fn().mockReturnValue(0),
};

describe("Cart", () => {
  it("renders the list name", () => {
    renderWithProviders(<Cart {...defaultProps} />);
    expect(screen.getByText("My List")).toBeDefined();
  });

  it("shows empty state when cart is empty", () => {
    renderWithProviders(<Cart {...defaultProps} />);
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
    renderWithProviders(<Cart {...defaultProps} entries={entries} />);

    expect(screen.getByText("Longsword")).toBeDefined();
    expect(screen.getByText("Shortsword")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("calls onSetQuantity when + is clicked", () => {
    const onSetQuantity = vi.fn();
    const entries = [makeEntry()];
    renderWithProviders(
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
    renderWithProviders(
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
    renderWithProviders(
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
    renderWithProviders(<Cart {...defaultProps} entries={entries} />);

    // Should show both original and discounted price
    expect(screen.getByText("10 gp")).toBeDefined();
    expect(screen.getByText("8 gp")).toBeDefined();
  });

  it("shows modifier label for preset modifiers", () => {
    const entries = [
      makeEntry({
        item: makeItem({ price: { gp: 10 } }),
        priceModifier: { type: "crafting" },
      }),
    ];
    renderWithProviders(<Cart {...defaultProps} entries={entries} />);

    expect(screen.getByText(/\(crafting\)/)).toBeDefined();
  });

  it("does not show modifier label for custom flat modifiers", () => {
    const entries = [
      makeEntry({
        item: makeItem({ price: { gp: 10 } }),
        priceModifier: { type: "flat", cp: -200 },
      }),
    ];
    renderWithProviders(<Cart {...defaultProps} entries={entries} />);

    expect(
      screen.queryByText(/\(crafting\)|\(selling\)|\(upgrading\)/),
    ).toBeNull();
  });

  it("shows the total price when items exist", () => {
    const entries = [makeEntry()];
    renderWithProviders(
      <Cart {...defaultProps} entries={entries} totalPrice={{ gp: 5 }} />,
    );

    expect(screen.getByText("Total:")).toBeDefined();
    expect(screen.getByText("5 gp")).toBeDefined();
  });

  it("shows Share link when entries exist", () => {
    const entries = [makeEntry()];
    renderWithProviders(<Cart {...defaultProps} entries={entries} />);
    expect(screen.getByText("Share")).toBeDefined();
  });

  it("does not show Share link when cart is empty", () => {
    renderWithProviders(<Cart {...defaultProps} />);
    expect(screen.queryByText("Share")).toBeNull();
  });

  it("opens the menu dropdown", () => {
    renderWithProviders(<Cart {...defaultProps} />);
    const trigger = screen.getByLabelText("List options");
    // Radix DropdownMenu requires pointer events to open
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(trigger);

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
    renderWithProviders(<Cart {...defaultProps} entries={entries} />);

    const el = screen.getByText("My Custom Item");
    // custom items should be a span, not a link
    expect(el.tagName).toBe("SPAN");
  });

  it("shows settings button for each entry", () => {
    const entries = [makeEntry()];
    renderWithProviders(<Cart {...defaultProps} entries={entries} />);
    expect(screen.getByTitle("Item settings")).toBeDefined();
  });
});
