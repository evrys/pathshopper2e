// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscountModal } from "./DiscountModal";

afterEach(cleanup);

const BASE_PRICE = { gp: 10 };

describe("DiscountModal", () => {
  it("renders the modal with item name", () => {
    render(
      <DiscountModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Longsword")).toBeDefined();
    expect(screen.getByLabelText("Discount per item")).toBeDefined();
  });

  it("applies a flat gp discount", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <DiscountModal
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

    expect(onApply).toHaveBeenCalledWith({ type: "flat", cp: 200 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("applies a flat sp discount", () => {
    const onApply = vi.fn();
    render(
      <DiscountModal
        itemName="Longsword"
        price={BASE_PRICE}
        onApply={onApply}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Discount per item"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Currency denomination"), {
      target: { value: "sp" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply).toHaveBeenCalledWith({ type: "flat", cp: 50 });
  });

  it("applies a percentage discount", () => {
    const onApply = vi.fn();
    render(
      <DiscountModal
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

    expect(onApply).toHaveBeenCalledWith({ type: "percent", percent: 25 });
  });

  it("clears discount when amount is 0", () => {
    const onApply = vi.fn();
    render(
      <DiscountModal
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

    expect(onApply).toHaveBeenCalledWith(undefined);
  });

  it("disables Apply when discount exceeds price", () => {
    render(
      <DiscountModal
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
  });

  it("disables Apply when percent exceeds 100", () => {
    render(
      <DiscountModal
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
  });

  it("shows a preview of the discounted price", () => {
    render(
      <DiscountModal
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
      <DiscountModal
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
      <DiscountModal
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
      <DiscountModal
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
      <DiscountModal
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
});
