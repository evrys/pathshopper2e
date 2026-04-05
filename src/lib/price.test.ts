import { describe, expect, it } from "vitest";
import {
  formatPrice,
  fromCopper,
  parseBudget,
  resolvePriceModifier,
  sumPrices,
  toCopper,
} from "./price";

describe("toCopper", () => {
  it("converts gp to copper", () => {
    expect(toCopper({ gp: 1 })).toBe(100);
    expect(toCopper({ gp: 14 })).toBe(1400);
  });

  it("converts sp to copper", () => {
    expect(toCopper({ sp: 1 })).toBe(10);
    expect(toCopper({ sp: 5 })).toBe(50);
  });

  it("converts cp directly", () => {
    expect(toCopper({ cp: 7 })).toBe(7);
  });

  it("handles mixed denominations", () => {
    expect(toCopper({ gp: 2, sp: 3, cp: 4 })).toBe(234);
  });

  it("handles empty price", () => {
    expect(toCopper({})).toBe(0);
  });
});

describe("fromCopper", () => {
  it("converts to largest denominations", () => {
    expect(fromCopper(234)).toEqual({ gp: 2, sp: 3, cp: 4 });
  });

  it("omits zero denominations", () => {
    expect(fromCopper(100)).toEqual({ gp: 1 });
    expect(fromCopper(50)).toEqual({ sp: 5 });
    expect(fromCopper(3)).toEqual({ cp: 3 });
  });

  it("returns empty for 0", () => {
    expect(fromCopper(0)).toEqual({});
  });
});

describe("formatPrice", () => {
  it("formats gp only", () => {
    expect(formatPrice({ gp: 140 })).toBe("140 gp");
  });

  it("formats mixed denominations", () => {
    expect(formatPrice({ gp: 2, sp: 3, cp: 4 })).toBe("2 gp 3 sp 4 cp");
  });

  it("formats sp only", () => {
    expect(formatPrice({ sp: 5 })).toBe("5 sp");
  });

  it("returns dash for empty price", () => {
    expect(formatPrice({})).toBe("—");
  });

  it("applies flat discount in cp to the price", () => {
    // 100 gp = 10000 cp, minus 1000 cp (10 gp) = 90 gp
    expect(formatPrice({ gp: 100 }, { type: "flat", cp: -1000 })).toBe("90 gp");
  });

  it("applies flat discount with denomination rollup", () => {
    // 1 gp = 100 cp, minus 50 cp = 5 sp
    expect(formatPrice({ gp: 1 }, { type: "flat", cp: -50 })).toBe("5 sp");
  });

  it("applies percentage discount", () => {
    // 50% off 100 gp = 50 gp
    expect(formatPrice({ gp: 100 }, { type: "percent", percent: -50 })).toBe(
      "50 gp",
    );
  });

  it("formats without discount when undefined", () => {
    expect(formatPrice({ gp: 10 })).toBe("10 gp");
  });
});

describe("parseBudget", () => {
  it("parses 'gp' format", () => {
    expect(parseBudget("140gp")).toEqual({ gp: 140 });
    expect(parseBudget("140 gp")).toEqual({ gp: 140 });
  });

  it("parses mixed format", () => {
    expect(parseBudget("12 gp 5 sp")).toEqual({ gp: 12, sp: 5 });
    expect(parseBudget("3gp 2sp 1cp")).toEqual({ gp: 3, sp: 2, cp: 1 });
  });

  it("parses plain number as gp", () => {
    expect(parseBudget("50")).toEqual({ gp: 50 });
  });

  it("parses decimal gp", () => {
    expect(parseBudget("1.5")).toEqual({ gp: 1, sp: 5 });
  });

  it("returns null for empty input", () => {
    expect(parseBudget("")).toBeNull();
    expect(parseBudget("  ")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseBudget("abc")).toBeNull();
  });
});

describe("sumPrices", () => {
  it("returns empty price for no entries", () => {
    expect(sumPrices([])).toEqual({});
  });

  it("sums a single entry with qty 1", () => {
    expect(sumPrices([{ price: { gp: 10 }, quantity: 1 }])).toEqual({
      gp: 10,
    });
  });

  it("multiplies price by quantity", () => {
    expect(sumPrices([{ price: { gp: 5 }, quantity: 3 }])).toEqual({
      gp: 15,
    });
  });

  it("sums multiple entries with mixed denominations", () => {
    const result = sumPrices([
      { price: { gp: 2, sp: 5 }, quantity: 2 },
      { price: { sp: 3, cp: 7 }, quantity: 1 },
    ]);
    // 2*(250cp) + 1*(37cp) = 537cp = 5gp 3sp 7cp
    expect(result).toEqual({ gp: 5, sp: 3, cp: 7 });
  });

  it("rolls up denominations correctly", () => {
    // 10 items at 15 sp each = 150 sp = 15 gp
    expect(sumPrices([{ price: { sp: 15 }, quantity: 10 }])).toEqual({
      gp: 15,
    });
  });

  it("applies flat discount in cp to individual entries", () => {
    // 100 gp = 10000 cp, minus 1000 cp (10 gp) = 90 gp
    expect(
      sumPrices([
        {
          price: { gp: 100 },
          quantity: 1,
          priceModifier: { type: "flat", cp: -1000 },
        },
      ]),
    ).toEqual({ gp: 90 });
  });

  it("sums discounted and non-discounted entries", () => {
    const result = sumPrices([
      // 100 gp minus 5000 cp (50 gp) = 50 gp
      {
        price: { gp: 100 },
        quantity: 1,
        priceModifier: { type: "flat", cp: -5000 },
      },
      { price: { gp: 10 }, quantity: 2 },
    ]);
    // 50 gp + 20 gp = 70 gp
    expect(result).toEqual({ gp: 70 });
  });

  it("applies percentage discount in sumPrices", () => {
    // 10% off 100 gp = 90 gp per item, 2 items = 180 gp
    expect(
      sumPrices([
        {
          price: { gp: 100 },
          quantity: 2,
          priceModifier: { type: "percent", percent: -10 },
        },
      ]),
    ).toEqual({ gp: 180 });
  });
});

describe("resolvePriceModifier", () => {
  it("returns cp directly for flat modifier (positive = surcharge)", () => {
    expect(resolvePriceModifier({ type: "flat", cp: 500 }, { gp: 100 })).toBe(
      500,
    );
  });

  it("returns negative cp for flat discount", () => {
    expect(resolvePriceModifier({ type: "flat", cp: -500 }, { gp: 100 })).toBe(
      -500,
    );
  });

  it("calculates copper from percentage modifier", () => {
    // 25% of 100 gp (10000 cp) = 2500 cp surcharge
    expect(
      resolvePriceModifier({ type: "percent", percent: 25 }, { gp: 100 }),
    ).toBe(2500);
  });

  it("calculates negative copper from negative percentage modifier", () => {
    // -25% of 100 gp (10000 cp) = -2500 cp discount
    expect(
      resolvePriceModifier({ type: "percent", percent: -25 }, { gp: 100 }),
    ).toBe(-2500);
  });

  it("rounds percentage modifier to nearest copper", () => {
    // 33% of 1 gp (100 cp) = 33 cp
    expect(
      resolvePriceModifier({ type: "percent", percent: 33 }, { gp: 1 }),
    ).toBe(33);
  });

  it("returns negated cp for upgrade modifier (always a discount)", () => {
    expect(
      resolvePriceModifier({ type: "upgrade", cp: 6500 }, { gp: 100 }),
    ).toBe(-6500);
  });

  it("calculates -50% for crafting modifier (always a discount)", () => {
    // -50% of 10 gp (1000 cp) = -500 cp
    expect(resolvePriceModifier({ type: "crafting" }, { gp: 10 })).toBe(-500);
  });
});
