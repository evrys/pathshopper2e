import { describe, expect, it } from "vitest";
import { parseCartString } from "./url";

describe("parseCartString", () => {
  it("returns empty map for empty string", () => {
    expect(parseCartString("")).toEqual(new Map());
  });

  it("parses a single item with default qty 1", () => {
    expect(parseCartString("sword-01")).toEqual(new Map([["sword-01", 1]]));
  });

  it("parses a single item with explicit qty", () => {
    expect(parseCartString("arrow-01*20")).toEqual(new Map([["arrow-01", 20]]));
  });

  it("parses multiple items separated by +", () => {
    const result = parseCartString("sword-01+shield-02*2+potion-03");
    expect(result).toEqual(
      new Map([
        ["sword-01", 1],
        ["shield-02", 2],
        ["potion-03", 1],
      ]),
    );
  });

  it("skips entries with qty <= 0", () => {
    expect(parseCartString("sword-01*0")).toEqual(new Map());
    expect(parseCartString("sword-01*-1")).toEqual(new Map());
  });

  it("treats non-numeric suffix after * as id with qty 1", () => {
    expect(parseCartString("some*thing")).toEqual(new Map([["some*thing", 1]]));
  });

  it("accepts legacy : separator for backwards compatibility", () => {
    expect(parseCartString("arrow-01:20")).toEqual(new Map([["arrow-01", 20]]));
    expect(parseCartString("sword-01+shield-02:2+potion-03")).toEqual(
      new Map([
        ["sword-01", 1],
        ["shield-02", 2],
        ["potion-03", 1],
      ]),
    );
  });

  it("handles qty 1 explicitly", () => {
    expect(parseCartString("item-01*1")).toEqual(new Map([["item-01", 1]]));
  });
});
