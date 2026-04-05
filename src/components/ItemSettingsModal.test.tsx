// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemSettingsModal } from "./ItemSettingsModal";

afterEach(cleanup);

const BASE_PRICE = { gp: 10 };

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
    expect(screen.getByLabelText("Discount per item")).toBeDefined();
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

    fireEvent.change(screen.getByLabelText("Discount per item"), {
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

    fireEvent.change(screen.getByLabelText("Discount per item"), {
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

    fireEvent.change(screen.getByLabelText("Discount per item"), {
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

    fireEvent.change(screen.getByLabelText("Discount per item"), {
      target: { value: "2.555" },
    });

    expect((screen.getByText("Apply") as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Discount must be a whole number of copper pieces",
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

    fireEvent.change(screen.getByLabelText("Discount per item"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("Currency denomination"), {
      target: { value: "%" },
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
        currentDiscount={{ type: "flat", cp: 200 }}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Discount per item"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledWith(undefined, "", undefined);
  });

  it("disables Apply when discount exceeds price", () => {
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Discount per item"), {
      target: { value: "20" },
    });

    const applyBtn = screen.getByText("Apply") as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe(
      "Discount cannot exceed the item price",
    );
  });

  it("disables Apply when percent exceeds 100", () => {
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Currency denomination"), {
      target: { value: "%" },
    });
    fireEvent.change(screen.getByLabelText("Discount per item"), {
      target: { value: "150" },
    });

    const applyBtn = screen.getByText("Apply") as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe(
      "Percentage cannot exceed 100%",
    );
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

    fireEvent.change(screen.getByLabelText("Discount per item"), {
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
        currentDiscount={{ type: "flat", cp: 200 }}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    const input = screen.getByLabelText(
      "Discount per item",
    ) as HTMLInputElement;
    expect(input.value).toBe("2");
    const select = screen.getByLabelText(
      "Currency denomination",
    ) as HTMLSelectElement;
    expect(select.value).toBe("gp");
  });

  it("initializes from an existing percent discount", () => {
    render(
      <ItemSettingsModal
        itemName="Longsword"
        price={BASE_PRICE}
        currentDiscount={{ type: "percent", percent: 15 }}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    const input = screen.getByLabelText(
      "Discount per item",
    ) as HTMLInputElement;
    expect(input.value).toBe("15");
    const select = screen.getByLabelText(
      "Currency denomination",
    ) as HTMLSelectElement;
    expect(select.value).toBe("%");
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

    fireEvent.change(screen.getByLabelText("Discount per item"), {
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
});
