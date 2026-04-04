// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SharedList } from "./SharedList";

afterEach(cleanup);

// Stub globals
vi.stubGlobal("__COMMIT_HASH__", "test123");

// tippy.js doesn't work in jsdom
vi.mock("tippy.js", () => ({
  default: () => ({ destroy: () => {} }),
}));
vi.mock("tippy.js/dist/tippy.css", () => ({}));

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
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it("shows empty state when no items in URL", () => {
    window.location.hash = "";
    render(<SharedList />);
    expect(screen.getByText("This shopping list is empty.")).toBeDefined();
  });

  it("shows the default title when no name is provided", () => {
    window.location.hash = "";
    render(<SharedList />);
    expect(screen.getByText("My shopping list")).toBeDefined();
  });

  it("shows the character name as title", () => {
    window.location.hash = "#name=Sir%20Reginald&items=w1";
    render(<SharedList />);
    expect(screen.getByText("Sir Reginald")).toBeDefined();
  });
  it("renders items from URL hash", () => {
    window.location.hash = "#items=w1*2+a1";
    render(<SharedList />);
    expect(screen.getByText("Longsword")).toBeDefined();
    expect(screen.getByText("Chain Mail")).toBeDefined();
    expect(screen.getByText("×2")).toBeDefined();
  });

  it("shows item count subtitle", () => {
    window.location.hash = "#items=w1*3";
    render(<SharedList />);
    expect(screen.getByText("3 items")).toBeDefined();
  });

  it("displays total price", () => {
    window.location.hash = "#items=w1*2+a1";
    render(<SharedList />);
    expect(screen.getByText("Total")).toBeDefined();
  });

  it("shows the Edit this list button", () => {
    window.location.hash = "#items=w1";
    render(<SharedList />);
    expect(screen.getByText("Edit this list")).toBeDefined();
  });

  it("shows discounted prices when discount is in URL", () => {
    // w1 at 1gp with 50cp (0.5gp) flat discount
    window.location.hash = "#items=w1~d50";
    render(<SharedList />);
    // Should show both original (1 gp) and discounted price (5 sp)
    const gpElements = screen.getAllByText("1 gp");
    expect(gpElements.length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 sp").length).toBeGreaterThan(0);
  });
});
