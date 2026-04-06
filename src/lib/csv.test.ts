import { describe, expect, it } from "vitest";
import type { CartEntry } from "../hooks/useCart";
import type { Item } from "../types";
import { entriesToCsv, parseCsvItems, parsePriceModifier } from "./csv";

function makeItem(
  overrides: Partial<Item> & { id: string; name: string },
): Item {
  return {
    level: 0,
    type: "held-items",
    price: {},
    category: "",
    traits: [],
    rarity: "common",
    bulk: 0,
    usage: "",
    source: "",
    sourceId: "",
    sourceCategory: "",
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
          type: "weapons",
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
    expect(lines[0]).toBe(
      "Name,Quantity,Level,Base Price,Category,Modifier Type,Price Modifier,Notes,URL",
    );
    expect(lines[1]).toBe(
      "Longsword,2,1,1 gp,weapons,,,,https://2e.aonprd.com/Search.aspx?q=Longsword",
    );
    expect(lines[2]).toBe(
      "Shield,1,0,2 gp,armor,,,,https://2e.aonprd.com/Search.aspx?q=Shield",
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
    expect(csv).toBe(
      "Name,Quantity,Level,Base Price,Category,Modifier Type,Price Modifier,Notes,URL",
    );
  });
});

describe("parseCsvItems", () => {
  it("parses a basic CSV with name and quantity", () => {
    const csv = "Name,Quantity\nLongsword,2\nShield,1";
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      { name: "Longsword", quantity: 2, isCustom: false },
      { name: "Shield", quantity: 1, isCustom: false },
    ]);
  });

  it("defaults quantity to 1 when column is missing", () => {
    const csv = "Name,Level\nLongsword,1\nShield,0";
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      { name: "Longsword", quantity: 1, isCustom: false },
      { name: "Shield", quantity: 1, isCustom: false },
    ]);
  });

  it("handles quoted fields with commas", () => {
    const csv = 'Name,Quantity\n"Aeon Stone, Dusty Rose",3';
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      { name: "Aeon Stone, Dusty Rose", quantity: 3, isCustom: false },
    ]);
  });

  it("handles quoted fields with escaped quotes", () => {
    const csv = 'Name,Quantity\n"""Special"" Item",1';
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      { name: '"Special" Item', quantity: 1, isCustom: false },
    ]);
  });

  it("skips empty rows", () => {
    const csv = "Name,Quantity\nLongsword,1\n\nShield,2\n";
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      { name: "Longsword", quantity: 1, isCustom: false },
      { name: "Shield", quantity: 2, isCustom: false },
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
          type: "weapons",
        }),
        quantity: 2,
      },
      {
        item: makeItem({
          id: "a2",
          name: "Aeon Stone, Dusty Rose",
          level: 5,
          price: { gp: 100 },
          type: "held-items",
        }),
        quantity: 1,
      },
    ];
    const csv = entriesToCsv(entries);
    const parsed = parseCsvItems(csv);
    expect(parsed).toEqual([
      { name: "Longsword", quantity: 2, isCustom: false, price: "1 gp" },
      {
        name: "Aeon Stone, Dusty Rose",
        quantity: 1,
        isCustom: false,
        price: "100 gp",
      },
    ]);
  });

  it("parses discount column", () => {
    const csv =
      "Name,Quantity,Discount\nLongsword,1,10%\nShield,2,5 gp\nHelm,1,";
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      {
        name: "Longsword",
        quantity: 1,
        priceModifier: { type: "percent", percent: 10 },
        isCustom: false,
      },
      {
        name: "Shield",
        quantity: 2,
        priceModifier: { type: "flat", cp: 500 },
        isCustom: false,
      },
      { name: "Helm", quantity: 1, isCustom: false },
    ]);
  });

  it("parses type=custom as isCustom", () => {
    const csv = "Name,Quantity,Type,Price\nMagic Wand,1,custom,50 gp";
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      { name: "Magic Wand", quantity: 1, isCustom: true, price: "50 gp" },
    ]);
  });
});

describe("parsePriceModifier", () => {
  it("parses percentage discount", () => {
    expect(parsePriceModifier("10%")).toEqual({ type: "percent", percent: 10 });
    expect(parsePriceModifier("25 %")).toEqual({
      type: "percent",
      percent: 25,
    });
  });

  it("parses flat discount in gp", () => {
    expect(parsePriceModifier("5 gp")).toEqual({ type: "flat", cp: 500 });
  });

  it("parses flat discount in sp", () => {
    expect(parsePriceModifier("3 sp")).toEqual({ type: "flat", cp: 30 });
  });

  it("parses flat discount in cp", () => {
    expect(parsePriceModifier("15 cp")).toEqual({ type: "flat", cp: 15 });
  });

  it("parses mixed denomination discount", () => {
    expect(parsePriceModifier("1 gp 5 sp 3 cp")).toEqual({
      type: "flat",
      cp: 153,
    });
  });

  it("returns undefined for empty string", () => {
    expect(parsePriceModifier("")).toBeUndefined();
    expect(parsePriceModifier("  ")).toBeUndefined();
  });

  it("returns undefined for invalid input", () => {
    expect(parsePriceModifier("free")).toBeUndefined();
  });

  it("parses 'sell' as sell modifier", () => {
    expect(parsePriceModifier("sell")).toEqual({ type: "sell" });
    expect(parsePriceModifier("Sell")).toEqual({ type: "sell" });
    expect(parsePriceModifier(" sell ")).toEqual({ type: "sell" });
  });
});

describe("entriesToCsv export details", () => {
  it("exports custom items with empty level and URL, type=custom", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "custom-1-123",
          name: "Magic Wand",
          price: { gp: 50 },
        }),
        quantity: 1,
      },
    ];
    const csv = entriesToCsv(entries);
    const lines = csv.split("\n");
    expect(lines[1]).toBe("Magic Wand,1,,50 gp,custom,,,,");
  });

  it("exports discounts in the Discount column", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Longsword",
          level: 1,
          price: { gp: 1 },
          type: "weapons",
        }),
        quantity: 1,
        priceModifier: { type: "percent", percent: 10 },
      },
    ];
    const csv = entriesToCsv(entries);
    const lines = csv.split("\n");
    expect(lines[1]).toContain(",10%,");
  });

  it("exports flat discounts in gp/sp/cp format", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Shield",
          level: 0,
          price: { gp: 2 },
          type: "armor",
        }),
        quantity: 1,
        priceModifier: { type: "flat", cp: 153 },
      },
    ];
    const csv = entriesToCsv(entries);
    const lines = csv.split("\n");
    expect(lines[1]).toContain(",1 gp 5 sp 3 cp,");
  });

  it("exports 'crafting' in Modifier Type column for crafting modifier", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Longsword",
          level: 1,
          price: { gp: 1 },
          type: "weapons",
        }),
        quantity: 1,
        priceModifier: { type: "crafting" },
      },
    ];
    const csv = entriesToCsv(entries);
    const lines = csv.split("\n");
    expect(lines[1]).toContain(",crafting,-50%,");
  });

  it("exports 'selling' in Modifier Type column for sell modifier", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Longsword",
          level: 1,
          price: { gp: 1 },
          type: "weapons",
        }),
        quantity: 1,
        priceModifier: { type: "sell" },
      },
    ];
    const csv = entriesToCsv(entries);
    const lines = csv.split("\n");
    expect(lines[1]).toContain(",selling,sell,");
  });

  it("exports 'upgrading' in Modifier Type column for upgrade modifier", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Longsword",
          level: 1,
          price: { gp: 100 },
          type: "weapons",
        }),
        quantity: 1,
        priceModifier: { type: "upgrade", cp: 6500 },
      },
    ];
    const csv = entriesToCsv(entries);
    const lines = csv.split("\n");
    expect(lines[1]).toContain(",upgrading,-65 gp,");
  });

  it("exports empty Modifier Type for flat and percent modifiers", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Longsword",
          level: 1,
          price: { gp: 1 },
          type: "weapons",
        }),
        quantity: 1,
        priceModifier: { type: "flat", cp: -500 },
      },
    ];
    const csv = entriesToCsv(entries);
    const lines = csv.split("\n");
    expect(lines[1]).toContain(",weapons,,-5 gp,");
  });
});

describe("complex roundtrip", () => {
  it("preserves all data through export → import for a complex shopping list", () => {
    const entries: CartEntry[] = [
      // Regular item, no discount
      {
        item: makeItem({
          id: "w1",
          name: "Longsword",
          level: 1,
          price: { gp: 1 },
          type: "weapons",
        }),
        quantity: 3,
      },
      // Regular item with percentage discount
      {
        item: makeItem({
          id: "a1",
          name: "Aeon Stone, Dusty Rose",
          level: 5,
          price: { gp: 100 },
          type: "held-items",
        }),
        quantity: 1,
        priceModifier: { type: "percent", percent: 25 },
      },
      // Regular item with flat discount
      {
        item: makeItem({
          id: "a2",
          name: "Chain Mail",
          level: 1,
          price: { gp: 6 },
          type: "armor",
        }),
        quantity: 2,
        priceModifier: { type: "flat", cp: 150 },
      },
      // Custom item, no discount
      {
        item: makeItem({
          id: "custom-1-100",
          name: "Homemade Potion",
          price: { gp: 25 },
        }),
        quantity: 5,
      },
      // Custom item with discount
      {
        item: makeItem({
          id: "custom-2-200",
          name: "Lucky Charm",
          price: { sp: 5 },
        }),
        quantity: 1,
        priceModifier: { type: "percent", percent: 50 },
      },
    ];

    const csv = entriesToCsv(entries);
    const parsed = parseCsvItems(csv);

    expect(parsed).toHaveLength(5);

    // Regular item, no discount
    expect(parsed[0]).toEqual({
      name: "Longsword",
      quantity: 3,
      isCustom: false,
      price: "1 gp",
    });

    // Regular item with percentage discount
    expect(parsed[1]).toEqual({
      name: "Aeon Stone, Dusty Rose",
      quantity: 1,
      priceModifier: { type: "percent", percent: 25 },
      isCustom: false,
      price: "100 gp",
    });

    // Regular item with flat discount (1 gp 5 sp = 150 cp)
    expect(parsed[2]).toEqual({
      name: "Chain Mail",
      quantity: 2,
      priceModifier: { type: "flat", cp: 150 },
      isCustom: false,
      price: "6 gp",
    });

    // Custom item, no discount
    expect(parsed[3]).toEqual({
      name: "Homemade Potion",
      quantity: 5,
      isCustom: true,
      price: "25 gp",
    });

    // Custom item with discount
    expect(parsed[4]).toEqual({
      name: "Lucky Charm",
      quantity: 1,
      priceModifier: { type: "percent", percent: 50 },
      isCustom: true,
      price: "5 sp",
    });
  });

  it("roundtrips preset modifier types (crafting, sell, upgrade)", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "w1",
          name: "Longsword",
          level: 1,
          price: { gp: 10 },
          type: "weapons",
        }),
        quantity: 1,
        priceModifier: { type: "crafting" },
      },
      {
        item: makeItem({
          id: "w2",
          name: "Shield",
          level: 0,
          price: { gp: 5 },
          type: "armor",
        }),
        quantity: 1,
        priceModifier: { type: "sell" },
      },
      {
        item: makeItem({
          id: "w3",
          name: "Striking Rune (Major)",
          level: 19,
          price: { gp: 31065 },
          type: "held-items",
        }),
        quantity: 1,
        priceModifier: { type: "upgrade", cp: 6500 },
      },
    ];

    const csv = entriesToCsv(entries);
    const parsed = parseCsvItems(csv);

    expect(parsed[0].priceModifier).toEqual({ type: "crafting" });
    expect(parsed[1].priceModifier).toEqual({ type: "sell" });
    expect(parsed[2].priceModifier).toEqual({ type: "upgrade", cp: -6500 });
  });

  it("parses modifier type column from manually-created CSV", () => {
    const csv = [
      "Name,Quantity,Modifier Type,Price Modifier",
      "Longsword,1,crafting,-50%",
      "Shield,1,selling,sell",
      "Rune,1,upgrading,-65 gp",
      "Potion,1,,10%",
    ].join("\n");
    const parsed = parseCsvItems(csv);
    expect(parsed[0].priceModifier).toEqual({ type: "crafting" });
    expect(parsed[1].priceModifier).toEqual({ type: "sell" });
    expect(parsed[2].priceModifier).toEqual({ type: "upgrade", cp: -6500 });
    expect(parsed[3].priceModifier).toEqual({ type: "percent", percent: 10 });
  });
});

describe("notes in CSV", () => {
  it("exports notes in the Notes column", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Longsword",
          level: 1,
          price: { gp: 1 },
          type: "weapons",
        }),
        quantity: 1,
        notes: "Buy from the smith",
      },
    ];
    const csv = entriesToCsv(entries);
    const lines = csv.split("\n");
    expect(lines[1]).toContain(",Buy from the smith,");
  });

  it("parses notes column on import", () => {
    const csv = "Name,Quantity,Notes\nLongsword,1,For the boss fight";
    const result = parseCsvItems(csv);
    expect(result).toEqual([
      {
        name: "Longsword",
        quantity: 1,
        notes: "For the boss fight",
        isCustom: false,
      },
    ]);
  });

  it("roundtrips notes through export → import", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Longsword",
          level: 1,
          price: { gp: 1 },
          type: "weapons",
        }),
        quantity: 2,
        notes: "Buy at market",
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
    const parsed = parseCsvItems(csv);
    expect(parsed[0].notes).toBe("Buy at market");
    expect(parsed[1].notes).toBeUndefined();
  });

  it("escapes notes containing commas", () => {
    const entries: CartEntry[] = [
      {
        item: makeItem({
          id: "a1",
          name: "Longsword",
          level: 1,
          price: { gp: 1 },
          type: "weapons",
        }),
        quantity: 1,
        notes: "Buy here, or there",
      },
    ];
    const csv = entriesToCsv(entries);
    const parsed = parseCsvItems(csv);
    expect(parsed[0].notes).toBe("Buy here, or there");
  });
});
