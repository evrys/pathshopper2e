// @vitest-environment jsdom
import * as Tooltip from "@radix-ui/react-tooltip";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { stubMatchMedia } from "../test-utils";
import type { Item } from "../types";
import { ItemTooltipWrapper } from "./ItemTooltip";

afterEach(cleanup);

// Stub matchMedia for useMediaQuery (desktop by default)
stubMatchMedia();

function renderWithProvider(ui: React.ReactElement) {
  return render(<Tooltip.Provider>{ui}</Tooltip.Provider>);
}

const ITEM: Item = {
  id: "w1",
  name: "Longsword",
  type: "weapons",
  level: 1,
  price: { gp: 1 },
  category: "Base Weapons",
  traits: ["versatile"],
  rarity: "common",
  bulk: 1,
  usage: "held in 1 hand",
  source: "Core Rulebook",
  sourceId: "1",
  sourceCategory: "Rulebooks",
  remaster: true,
  description: "<p>A common longsword.</p>",
  plainDescription: "A common longsword.",
};

describe("ItemTooltipWrapper", () => {
  it("renders children inside a span", () => {
    const { container } = renderWithProvider(
      <ItemTooltipWrapper item={ITEM}>
        <a href="/test">Longsword</a>
      </ItemTooltipWrapper>,
    );
    const span = container.querySelector("span");
    expect(span).toBeDefined();
    const link = container.querySelector("a");
    expect(link).toBeDefined();
    expect(link?.textContent).toBe("Longsword");
  });

  it("wraps children without breaking them", () => {
    const { container } = renderWithProvider(
      <ItemTooltipWrapper item={ITEM}>
        <span data-testid="child">Hello</span>
      </ItemTooltipWrapper>,
    );
    expect(container.querySelector("[data-testid='child']")).toBeDefined();
  });
});
