import { describe, expect, it } from "vitest";
import type { CartEntry } from "../hooks/useCart";
import type { Item } from "../types";
import { entriesToCsv, parseCsvItems } from "./csv";

function makeItem(
  overrides: Partial<Item> & { id: string; name: string },
): Item {
  return {
    level: 0,
    type: "equipment",
    price: {},
    category: "",
    traits: [],
    rarity: "common",
    bulk: 0,
    usage: "",
    source: "",
    remaster: true,
    description: "",
    plainDescription: "",
    ...overrides,
  };
}

describe("entriesToCsv", () => {
  it("produces header + data rows", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Longsword",
          level: 1,
          price: { gp: 1 },
          type: "weapon",
        }),
        quantity: 2,
      },
      {
        item: makeItem({
          id: "a2",
          name: "Shield",
          level: 0,
          price: { gp: 2 },
          type: "armor",
        }),
        quantity: 1,
      },
    ];
    const csv = entriesToCsv(entries);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Name,Quantity,Level,Price,Type,URL");
    expect(lines[1]).toBe(
      "Longsword,2,1,1 gp,weapon,https://2e.aonprd.com/Search.aspx?q=Longsword",
    );
    expect(lines[2]).toBe(
      "Shield,1,0,2 gp,armor,https://2e.aonprd.com/Search.aspx?q=Shield",
    );
  });

  it("escapes commas in item names", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({ id: "a1", name: "Aeon Stone, Dusty Rose" }),
        quantity: 1,
      },
    ];
    const csv = entriesToCsv(entries);
    expect(csv).toContain('"Aeon Stone, Dusty Rose"');
  });

  it("returns only header for empty list", () => {
    const csv = entriesToCsv([]);
    expect(csv).toBe("Name,Quantity,Level,Price,Type,URL");
  });
});

describe("parseCsvItems", () => {
  it("parses a basic CSV with name and quantity", () => {
    const csv = "Name,Quantity\nLongsword,2\nShield,1";
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      { name: "Longsword", quantity: 2 },
      { name: "Shield", quantity: 1 },
    ]);
  });

  it("defaults quantity to 1 when column is missing", () => {
    const csv = "Name,Level\nLongsword,1\nShield,0";
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      { name: "Longsword", quantity: 1 },
      { name: "Shield", quantity: 1 },
    ]);
  });

  it("handles quoted fields with commas", () => {
    const csv = 'Name,Quantity\n"Aeon Stone, Dusty Rose",3';
    const result = parseCsvItems(csv);
    expect(result).toEqual([{ name: "Aeon Stone, Dusty Rose", quantity: 3 }]);
  });

  it("handles quoted fields with escaped quotes", () => {
    const csv = 'Name,Quantity\n"""Special"" Item",1';
    const result = parseCsvItems(csv);
    expect(result).toEqual([{ name: '"Special" Item', quantity: 1 }]);
  });

  it("skips empty rows", () => {
    const csv = "Name,Quantity\nLongsword,1\n\nShield,2\n";
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      { name: "Longsword", quantity: 1 },
      { name: "Shield", quantity: 2 },
    ]);
  });

  it("returns empty for CSV without Name column", () => {
    const csv = "Item,Qty\nLongsword,1";
    expect(parseCsvItems(csv)).toEqual([]);
  });

  it("returns empty for header-only CSV", () => {
    const csv = "Name,Quantity";
    expect(parseCsvItems(csv)).toEqual([]);
  });

  it("roundtrips through export and import", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Longsword",
          level: 1,
          price: { gp: 1 },
          type: "weapon",
        }),
        quantity: 2,
      },
      {
        item: makeItem({
          id: "a2",
          name: "Aeon Stone, Dusty Rose",
          level: 5,
          price: { gp: 100 },
          type: "equipment",
        }),
        quantity: 1,
      },
    ];
    const csv = entriesToCsv(entries);
    const parsed = parseCsvItems(csv);
    expect(parsed).toEqual([
      { name: "Longsword", quantity: 2 },
      { name: "Aeon Stone, Dusty Rose", quantity: 1 },
    ]);
  });
});
