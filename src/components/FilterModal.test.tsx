// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Item } from "../types";
import { FilterModal } from "./FilterModal";

afterEach(cleanup);

const ITEMS: Item[] = [
  {
    id: "w1",
    name: "Longsword",
    type: "weapon",
    level: 1,
    price: { gp: 1 },
    category: "Base Weapons",
    traits: ["versatile"],
    rarity: "common",
    bulk: 1,
    usage: "held in 1 hand",
    source: "Core Rulebook",
    sourceId: "1",
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
    traits: ["noisy", "flexible"],
    rarity: "uncommon",
    bulk: 2,
    usage: "worn armor",
    source: "Core Rulebook",
    sourceId: "1",
    remaster: true,
    description: "",
    plainDescription: "",
  },
];

function defaultFilters() {
  return {
    typeFilter: new Set<string>(),
    rarityFilter: new Set<string>(),
    remasterFilter: new Set<string>(),
    traitFilter: new Set<string>(),
    sourceFilter: new Set<string>(),
    minLevel: "",
    maxLevel: "",
  };
}

describe("FilterModal", () => {
  it("renders the Filters button", () => {
    render(
      <FilterModal
        items={ITEMS}
        onFiltersChange={() => {}}
        {...defaultFilters()}
      />,
    );
    expect(screen.getByText("Filters")).toBeDefined();
  });

  it("shows a badge when filters are active", () => {
    render(
      <FilterModal
        items={ITEMS}
        {...defaultFilters()}
        typeFilter={new Set(["weapon"])}
        minLevel="5"
        onFiltersChange={() => {}}
      />,
    );
    // 2 active filters → badge should show "2"
    expect(screen.getByText("2")).toBeDefined();
  });

  it("opens the filter modal on click", () => {
    render(
      <FilterModal
        items={ITEMS}
        onFiltersChange={() => {}}
        {...defaultFilters()}
      />,
    );
    fireEvent.click(screen.getByText("Filters"));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Item Type")).toBeDefined();
    expect(screen.getByText("Rarity")).toBeDefined();
    expect(screen.getByText("Level Range")).toBeDefined();
  });

  it("calls onFiltersChange when level range changes", () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterModal
        items={ITEMS}
        onFiltersChange={onFiltersChange}
        {...defaultFilters()}
      />,
    );
    fireEvent.click(screen.getByText("Filters"));

    fireEvent.change(screen.getByLabelText("Minimum level"), {
      target: { value: "3" },
    });
    expect(onFiltersChange).toHaveBeenCalledWith({ minLevel: "3" });
  });

  it("clears all filters when Clear is clicked", () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterModal
        items={ITEMS}
        {...defaultFilters()}
        typeFilter={new Set(["weapon"])}
        onFiltersChange={onFiltersChange}
      />,
    );
    fireEvent.click(screen.getByText("Filters"));
    fireEvent.click(screen.getByText("Clear"));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        typeFilter: new Set(),
        rarityFilter: new Set(),
        traitFilter: new Set(),
        sourceFilter: new Set(),
        minLevel: "",
        maxLevel: "",
      }),
    );
  });

  it("resets to defaults when Reset is clicked", () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterModal
        items={ITEMS}
        {...defaultFilters()}
        onFiltersChange={onFiltersChange}
      />,
    );
    fireEvent.click(screen.getByText("Filters"));
    fireEvent.click(screen.getByText("Reset"));

    const call = onFiltersChange.mock.calls[0][0];
    expect(call.rarityFilter).toEqual(new Set(["common", "uncommon"]));
    expect(call.remasterFilter).toEqual(new Set(["remastered"]));
  });

  it("closes when Done is clicked", () => {
    render(
      <FilterModal
        items={ITEMS}
        onFiltersChange={() => {}}
        {...defaultFilters()}
      />,
    );
    fireEvent.click(screen.getByText("Filters"));
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
