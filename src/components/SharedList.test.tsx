// @vitest-environment jsdom
import * as Tooltip from "@radix-ui/react-tooltip";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedList } from "../hooks/useSavedLists";
import { stubMatchMedia } from "../test-utils";
import { SharedList } from "./SharedList";

afterEach(cleanup);

function renderWithProviders(ui: React.ReactElement) {
  return render(<Tooltip.Provider>{ui}</Tooltip.Provider>);
}

// Stub globals
vi.stubGlobal("__COMMIT_HASH__", "test123");
// Stub matchMedia for useMediaQuery (desktop by default)
stubMatchMedia();

vi.mock("../hooks/useItems", () => ({
  useItems: () => ({
    items: [
      {
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
      },
      {
        id: "a1",
        name: "Chain Mail",
        type: "armor",
        level: 1,
        price: { gp: 6 },
        category: "Base Armor",
        traits: [],
        rarity: "common",
        bulk: 2,
        usage: "worn armor",
        source: "Core Rulebook",
        remaster: true,
        description: "",
        plainDescription: "",
      },
    ],
    loading: false,
  }),
}));

describe("SharedList", () => {
  let originalHash: string;

  beforeEach(() => {
    originalHash = window.location.hash;
    localStorage.clear();
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it("shows empty state when no items in URL", () => {
    window.location.hash = "";
    renderWithProviders(<SharedList />);
    expect(screen.getByText("This shopping list is empty.")).toBeDefined();
  });

  it("shows the default title when no name is provided", () => {
    window.location.hash = "";
    renderWithProviders(<SharedList />);
    expect(screen.getByText("My shopping list")).toBeDefined();
  });

  it("shows the character name as title", () => {
    window.location.hash = "#name=Sir%20Reginald&items=w1";
    renderWithProviders(<SharedList />);
    expect(screen.getByText("Sir Reginald")).toBeDefined();
  });
  it("renders items from URL hash", () => {
    window.location.hash = "#items=w1*2+a1";
    renderWithProviders(<SharedList />);
    expect(screen.getByText("Longsword")).toBeDefined();
    expect(screen.getByText("Chain Mail")).toBeDefined();
    expect(screen.getByText("×2")).toBeDefined();
  });

  it("shows item count subtitle", () => {
    window.location.hash = "#items=w1*3";
    renderWithProviders(<SharedList />);
    expect(screen.getByText("3 items")).toBeDefined();
  });

  it("displays total price", () => {
    window.location.hash = "#items=w1*2+a1";
    renderWithProviders(<SharedList />);
    expect(screen.getByText("Total")).toBeDefined();
  });

  it("shows the Edit this list button", () => {
    window.location.hash = "#items=w1";
    renderWithProviders(<SharedList />);
    expect(screen.getByText("Edit this list")).toBeDefined();
  });

  it("shows discounted prices when discount is in URL", () => {
    // w1 at 1gp with -50cp flat discount
    window.location.hash = "#items=w1~d-50";
    renderWithProviders(<SharedList />);
    // Should show both original (1 gp) and discounted price (5 sp)
    const gpElements = screen.getAllByText("1 gp");
    expect(gpElements.length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 sp").length).toBeGreaterThan(0);
  });

  it("saves discounts when editing a shared list", () => {
    // w1 with a -50cp flat discount
    window.location.hash = "#items=w1~d-50&name=Tester";
    renderWithProviders(<SharedList />);

    const editBtn = screen.getByText("Edit this list");

    // jsdom may throw on navigation; we only care about localStorage
    try {
      fireEvent.click(editBtn);
    } catch {
      // "Not implemented: navigation" — expected in jsdom
    }

    // Verify the list was saved to localStorage with discounts
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("pathshopper2e:list:"),
    );
    expect(keys).toHaveLength(1);
    const saved = JSON.parse(
      localStorage.getItem(keys[0]) ?? "{}",
    ) as SavedList;
    expect(saved.items).toEqual({ w1: 1 });
    expect(saved.priceModifiers).toEqual({ w1: { type: "flat", cp: -50 } });
    expect(saved.name).toBe("Tester");
  });

  it("saves custom items when editing a shared list", () => {
    // w1 + a custom item "Wand" costing 50gp
    window.location.hash = "#items=w1+custom-0*2&custom=Wand~50gp";
    renderWithProviders(<SharedList />);

    const editBtn = screen.getByText("Edit this list");

    try {
      fireEvent.click(editBtn);
    } catch {
      // "Not implemented: navigation" — expected in jsdom
    }

    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("pathshopper2e:list:"),
    );
    expect(keys).toHaveLength(1);
    const saved = JSON.parse(
      localStorage.getItem(keys[0]) ?? "{}",
    ) as SavedList;
    expect(saved.items).toEqual({ w1: 1, "custom-0": 2 });
    expect(saved.customItems).toEqual([
      { id: "custom-0", name: "Wand", price: { gp: 50 } },
    ]);
  });

  it("saves notes when editing a shared list", () => {
    window.location.hash = "#items=w1&notes=w1%3ABuy%20from%20smith";
    renderWithProviders(<SharedList />);

    const editBtn = screen.getByText("Edit this list");
    try {
      fireEvent.click(editBtn);
    } catch {
      // "Not implemented: navigation" — expected in jsdom
    }

    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("pathshopper2e:list:"),
    );
    expect(keys).toHaveLength(1);
    const saved = JSON.parse(
      localStorage.getItem(keys[0]) ?? "{}",
    ) as SavedList;
    expect(saved.notes).toEqual({ w1: "Buy from smith" });
  });

  it("displays notes on the shared list", () => {
    window.location.hash = "#items=w1&notes=w1%3AMy%20note";
    renderWithProviders(<SharedList />);
    expect(screen.getByText("My note")).toBeDefined();
  });
});
