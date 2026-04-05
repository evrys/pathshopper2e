// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UpgradeOption } from "../lib/variants";
import { ItemSettingsModal } from "./ItemSettingsModal";

afterEach(cleanup);

const BASE_PRICE = { gp: 10 };

/** Select the Custom (gp) Price modifier preset to reveal the amount input. */
function selectCustomGp() {
  fireEvent.change(screen.getByLabelText("Price modifier"), {
    target: { value: "custom-gp" },
  });
}

/** Select the Custom (%) Price modifier preset to reveal the amount input. */
function selectCustomPercent() {
  fireEvent.change(screen.getByLabelText("Price modifier"), {
    target: { value: "custom-percent" },
  });
}

describe("ItemSettingsModal", () => {
  it("renders the modal with item name", () => {
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Longsword")).toBeDefined();
    expect(screen.getByLabelText("Price modifier")).toBeDefined();
    expect(screen.getByLabelText("Notes")).toBeDefined();
  });

  it("applies a flat gp discount", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={onApply}
        onClose={onClose}
      />,
    );

    selectCustomGp();
    fireEvent.change(screen.getByLabelText("Amount per item"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledWith(
      { type: "flat", cp: 200 },
      "",
      undefined,
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("applies a fractional gp discount equivalent to sp", () => {
    const onApply = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    selectCustomGp();
    fireEvent.change(screen.getByLabelText("Amount per item"), {
      target: { value: "0.5" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledWith(
      { type: "flat", cp: 50 },
      "",
      undefined,
    );
  });

  it("applies a fractional gp discount (whole copper)", () => {
    const onApply = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    selectCustomGp();
    fireEvent.change(screen.getByLabelText("Amount per item"), {
      target: { value: "2.5" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledWith(
      { type: "flat", cp: 250 },
      "",
      undefined,
    );
  });

  it("disables Apply when fractional discount is not whole copper", () => {
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    selectCustomGp();
    fireEvent.change(screen.getByLabelText("Amount per item"), {
      target: { value: "2.555" },
    });

    expect((screen.getByText("Apply") as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Must be a whole number of copper pieces",
    );
  });

  it("applies a percentage discount", () => {
    const onApply = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    selectCustomPercent();
    fireEvent.change(screen.getByLabelText("Amount per item"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledWith(
      { type: "percent", percent: 25 },
      "",
      undefined,
    );
  });

  it("clears discount when amount is 0", () => {
    const onApply = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        currentModifier={{ type: "flat", cp: 200 }}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Amount per item"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledWith(undefined, "", undefined);
  });

  it("allows custom gp amount exceeding item price (surcharge)", () => {
    const onApply = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    selectCustomGp();
    fireEvent.change(screen.getByLabelText("Amount per item"), {
      target: { value: "20" },
    });

    const applyBtn = screen.getByText("Apply") as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);
  });

  it("allows percent exceeding 100 (surcharge)", () => {
    const onApply = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    selectCustomPercent();
    fireEvent.change(screen.getByLabelText("Amount per item"), {
      target: { value: "150" },
    });

    const applyBtn = screen.getByText("Apply") as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);
  });

  it("shows a preview of the discounted price", () => {
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    selectCustomGp();
    fireEvent.change(screen.getByLabelText("Amount per item"), {
      target: { value: "3" },
    });

    // Preview should show "10 gp → 7 gp"
    expect(screen.getByText(/→/)).toBeDefined();
  });

  it("initializes from an existing flat discount", () => {
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        currentModifier={{ type: "flat", cp: 200 }}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    const preset = screen.getByLabelText("Price modifier") as HTMLSelectElement;
    expect(preset.value).toBe("custom-gp");
    const input = screen.getByLabelText("Amount per item") as HTMLInputElement;
    expect(input.value).toBe("2");
  });

  it("initializes from an existing percent discount", () => {
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        currentModifier={{ type: "percent", percent: 15 }}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    const preset = screen.getByLabelText("Price modifier") as HTMLSelectElement;
    expect(preset.value).toBe("custom-percent");
    const input = screen.getByLabelText("Amount per item") as HTMLInputElement;
    expect(input.value).toBe("15");
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={() => {}}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking the overlay background", () => {
    const onClose = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={() => {}}
        onClose={onClose}
      />,
    );

    const overlay = screen.getByRole("dialog");
    fireEvent.mouseDown(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // --- Notes-specific tests ---

  it("submits notes along with discount", () => {
    const onApply = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    selectCustomGp();
    fireEvent.change(screen.getByLabelText("Amount per item"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Buy from Trader Joe" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledWith(
      { type: "flat", cp: 100 },
      "Buy from Trader Joe",
      undefined,
    );
  });

  it("submits notes without a discount", () => {
    const onApply = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Need this for the dungeon" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledWith(
      undefined,
      "Need this for the dungeon",
      undefined,
    );
  });

  it("initializes with existing notes", () => {
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        currentNotes="Existing note"
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    const textarea = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Existing note");
  });

  it("trims whitespace from notes on submit", () => {
    const onApply = vi.fn();
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "  padded  " },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledWith(undefined, "padded", undefined);
  });

  describe("custom item editing", () => {
    it("does not show name/price fields for non-custom items", () => {
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      expect(screen.queryByLabelText("Name")).toBeNull();
      expect(screen.queryByLabelText("Price")).toBeNull();
    });

    it("shows name/price fields for custom items", () => {
      render(
        <ItemSettingsModal
          itemName="Magic Wand"
          price={{ gp: 5 }}
          isCustom
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      expect(screen.getByLabelText("Name")).toBeDefined();
      expect(screen.getByLabelText("Price")).toBeDefined();
    });

    it("pre-fills name and price from current values", () => {
      render(
        <ItemSettingsModal
          itemName="Magic Wand"
          price={{ sp: 30 }}
          isCustom
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
      const priceInput = screen.getByLabelText("Price") as HTMLInputElement;
      const denomSelect = screen.getByLabelText(
        "Price denomination",
      ) as HTMLSelectElement;
      expect(nameInput.value).toBe("Magic Wand");
      expect(priceInput.value).toBe("30");
      expect(denomSelect.value).toBe("sp");
    });

    it("passes customUpdate on apply", () => {
      const onApply = vi.fn();
      render(
        <ItemSettingsModal
          itemName="Wand"
          price={{ gp: 5 }}
          isCustom
          onApply={onApply}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText("Name"), {
        target: { value: "Better Wand" },
      });
      fireEvent.change(screen.getByLabelText("Price"), {
        target: { value: "10" },
      });
      fireEvent.click(screen.getByText("Apply"));
      expect(onApply).toHaveBeenCalledWith(undefined, "", {
        name: "Better Wand",
        price: { gp: 10 },
      });
    });

    it("changes price denomination for custom items", () => {
      const onApply = vi.fn();
      render(
        <ItemSettingsModal
          itemName="Wand"
          price={{ gp: 5 }}
          isCustom
          onApply={onApply}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText("Price denomination"), {
        target: { value: "sp" },
      });
      fireEvent.change(screen.getByLabelText("Price"), {
        target: { value: "50" },
      });
      fireEvent.click(screen.getByText("Apply"));
      expect(onApply).toHaveBeenCalledWith(undefined, "", {
        name: "Wand",
        price: { sp: 50 },
      });
    });

    it("disables apply when custom name is empty", () => {
      render(
        <ItemSettingsModal
          itemName="Wand"
          price={{ gp: 5 }}
          isCustom
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText("Name"), {
        target: { value: "" },
      });
      expect((screen.getByText("Apply") as HTMLButtonElement).disabled).toBe(
        true,
      );
    });

    it("does not pass customUpdate for non-custom items", () => {
      const onApply = vi.fn();
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          onApply={onApply}
          onClose={() => {}}
        />,
      );
      fireEvent.click(screen.getByText("Apply"));
      expect(onApply).toHaveBeenCalledWith(undefined, "", undefined);
    });
  });

  describe("discount presets", () => {
    const UPGRADE_OPTIONS: UpgradeOption[] = [
      { name: "Striking (Greater)", priceCp: 106500, priceDisplay: "1065 gp" },
      { name: "Striking", priceCp: 6500, priceDisplay: "65 gp" },
    ];

    it("renders the Discount dropdown", () => {
      render(
        <ItemSettingsModal
          itemName="Striking (Major)"
          price={{ gp: 31065 }}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      expect(screen.getByLabelText("Price modifier")).toBeDefined();
    });

    it("shows upgrade options when provided", () => {
      render(
        <ItemSettingsModal
          itemName="Striking (Major)"
          price={{ gp: 31065 }}
          upgradeOptions={UPGRADE_OPTIONS}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      const select = screen.getByLabelText(
        "Price modifier",
      ) as HTMLSelectElement;
      const options = [...select.options].map((o) => o.text);
      expect(options).toContain("Upgrade from Striking (Greater) (-1065 gp)");
      expect(options).toContain("Upgrade from Striking (-65 gp)");
    });

    it("always shows None, Crafting, Custom (gp), and Custom (%) options", () => {
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      const select = screen.getByLabelText(
        "Price modifier",
      ) as HTMLSelectElement;
      const options = [...select.options].map((o) => o.text);
      expect(options).toContain("None");
      expect(options).toContain("Crafting (-50%)");
      expect(options).toContain("Custom (gp)");
      expect(options).toContain("Custom (%)");
    });

    it("selecting an upgrade option applies an upgrade discount", () => {
      const onApply = vi.fn();
      render(
        <ItemSettingsModal
          itemName="Striking (Major)"
          price={{ gp: 31065 }}
          upgradeOptions={UPGRADE_OPTIONS}
          onApply={onApply}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText("Price modifier"), {
        target: { value: "upgrade-1" },
      });
      fireEvent.click(screen.getByText("Apply"));
      expect(onApply).toHaveBeenCalledWith(
        { type: "upgrade", cp: 6500 },
        "",
        undefined,
      );
    });

    it("selecting crafting applies a crafting discount", () => {
      const onApply = vi.fn();
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          upgradeOptions={[]}
          onApply={onApply}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText("Price modifier"), {
        target: { value: "crafting" },
      });
      fireEvent.click(screen.getByText("Apply"));
      expect(onApply).toHaveBeenCalledWith({ type: "crafting" }, "", undefined);
    });

    it("selecting Custom (gp) shows the amount input", () => {
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText("Price modifier"), {
        target: { value: "custom-gp" },
      });
      expect(screen.getByLabelText("Amount per item")).toBeDefined();
    });

    it("selecting Custom (%) shows the amount input", () => {
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText("Price modifier"), {
        target: { value: "custom-percent" },
      });
      expect(screen.getByLabelText("Amount per item")).toBeDefined();
    });

    it("hides the amount input for non-custom presets", () => {
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      // Default is "None"
      expect(screen.queryByLabelText("Amount per item")).toBeNull();
      // Crafting preset
      fireEvent.change(screen.getByLabelText("Price modifier"), {
        target: { value: "crafting" },
      });
      expect(screen.queryByLabelText("Amount per item")).toBeNull();
    });

    it("shows a preview for preset discounts", () => {
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText("Price modifier"), {
        target: { value: "crafting" },
      });
      expect(screen.getByText(/→/)).toBeDefined();
    });

    it("initializes preset from existing crafting discount", () => {
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          currentModifier={{ type: "crafting" }}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      const select = screen.getByLabelText(
        "Price modifier",
      ) as HTMLSelectElement;
      expect(select.value).toBe("crafting");
    });

    it("initializes preset from existing upgrade discount", () => {
      render(
        <ItemSettingsModal
          itemName="Striking (Major)"
          price={{ gp: 31065 }}
          upgradeOptions={UPGRADE_OPTIONS}
          currentModifier={{ type: "upgrade", cp: 6500 }}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      const select = screen.getByLabelText(
        "Price modifier",
      ) as HTMLSelectElement;
      expect(select.value).toBe("upgrade-1");
    });

    it("initializes as custom-gp for flat discounts not matching upgrades", () => {
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          currentModifier={{ type: "flat", cp: 200 }}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      const select = screen.getByLabelText(
        "Price modifier",
      ) as HTMLSelectElement;
      expect(select.value).toBe("custom-gp");
    });

    it("initializes as custom-percent for non-50% discounts", () => {
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          currentModifier={{ type: "percent", percent: 25 }}
          onApply={() => {}}
          onClose={() => {}}
        />,
      );
      const select = screen.getByLabelText(
        "Price modifier",
      ) as HTMLSelectElement;
      expect(select.value).toBe("custom-percent");
    });

    it("selecting None clears the discount", () => {
      const onApply = vi.fn();
      render(
        <ItemSettingsModal
          itemName="Longsword"
          price={BASE_PRICE}
          currentModifier={{ type: "percent", percent: 50 }}
          onApply={onApply}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText("Price modifier"), {
        target: { value: "none" },
      });
      fireEvent.click(screen.getByText("Apply"));
      expect(onApply).toHaveBeenCalledWith(undefined, "", undefined);
    });
  });
});
