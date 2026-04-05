import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CP_PER, formatPrice, fromCopper, toCopper } from "../lib/price";
import type { Discount, Price } from "../types";
import styles from "./ItemSettingsModal.module.css";

type Denomination = "gp" | "%";

/** Convert a flat copper discount into a gp amount. */
function cpToGp(cp: number): number {
  return cp / CP_PER.gp;
}

/** Determine the initial amount + denomination from an existing Discount. */
function initFromDiscount(d: Discount): {
  amount: string;
  denom: Denomination;
} {
  if (d.type === "percent") {
    return { amount: String(d.percent), denom: "%" };
  }
  return { amount: String(cpToGp(d.cp)), denom: "gp" };
}

type PriceDenomination = "gp" | "sp" | "cp";

/** Find the best-fit denomination for a Price object. */
function priceToDenom(price: Price): {
  amount: number;
  denom: PriceDenomination;
} {
  if (price.gp) return { amount: price.gp, denom: "gp" };
  if (price.sp) return { amount: price.sp, denom: "sp" };
  if (price.cp) return { amount: price.cp, denom: "cp" };
  return { amount: 0, denom: "gp" };
}

interface ItemSettingsModalProps {
  itemName: string;
  price: Price;
  /** Whether this is a custom item whose name/price can be edited. */
  isCustom?: boolean;
  /** Current discount, if any. */
  currentDiscount?: Discount;
  /** Current notes, if any. */
  currentNotes?: string;
  /** Called with the new discount, notes, and optional custom item updates. */
  onApply: (
    discount: Discount | undefined,
    notes: string,
    customUpdate?: { name: string; price: Price },
  ) => void;
  onClose: () => void;
}

export function ItemSettingsModal({
  itemName,
  price,
  isCustom,
  currentDiscount,
  currentNotes,
  onApply,
  onClose,
}: ItemSettingsModalProps) {
  const init = currentDiscount ? initFromDiscount(currentDiscount) : null;
  const [amount, setAmount] = useState(init?.amount ?? "");
  const [denomination, setDenomination] = useState<Denomination>(
    init?.denom ?? "gp",
  );
  const [notes, setNotes] = useState(currentNotes ?? "");
  const notesRef = useRef<HTMLInputElement>(null);

  // Custom item fields
  const priceInit = priceToDenom(price);
  const [customName, setCustomName] = useState(itemName);
  const [customPriceAmount, setCustomPriceAmount] = useState(
    priceInit.amount > 0 ? String(priceInit.amount) : "",
  );
  const [customPriceDenom, setCustomPriceDenom] = useState<PriceDenomination>(
    priceInit.denom,
  );

  useEffect(() => {
    notesRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const parsed = amount === "" ? 0 : Number(amount);
  const isPercent = denomination === "%";

  // Effective price: use custom price fields when editing a custom item
  const parsedCustomPrice =
    customPriceAmount === "" ? 0 : Number(customPriceAmount);
  const effectivePrice =
    isCustom && parsedCustomPrice > 0
      ? ({ [customPriceDenom]: parsedCustomPrice } as Price)
      : isCustom
        ? ({} as Price)
        : price;

  const discountCp = !Number.isFinite(parsed)
    ? 0
    : isPercent
      ? Math.round((parsed / 100) * toCopper(effectivePrice))
      : parsed * CP_PER.gp;
  const priceCp = toCopper(effectivePrice);
  const customPriceCp = parsedCustomPrice * CP_PER[customPriceDenom];
  const isValid =
    Number.isFinite(parsed) &&
    parsed >= 0 &&
    discountCp <= priceCp &&
    (!isPercent || parsed <= 100) &&
    Number.isInteger(discountCp) &&
    (!isCustom || customName.trim().length > 0) &&
    (!isCustom || Number.isInteger(customPriceCp));
  const discountedPrice = fromCopper(Math.max(0, priceCp - discountCp));

  // Compute a user-facing error for the discount field
  const discountError = (() => {
    if (amount === "" || parsed === 0) return undefined;
    if (!Number.isFinite(parsed) || parsed < 0)
      return "Discount must be a positive number";
    if (isPercent && parsed > 100) return "Percentage cannot exceed 100%";
    if (!isPercent && !Number.isInteger(discountCp))
      return "Discount must be a whole number of copper pieces";
    if (discountCp > priceCp) return "Discount cannot exceed the item price";
    return undefined;
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    let discount: Discount | undefined;
    if (discountCp === 0) {
      discount = undefined;
    } else if (isPercent) {
      discount = { type: "percent", percent: parsed };
    } else {
      discount = { type: "flat", cp: discountCp };
    }
    const customUpdate = isCustom
      ? { name: customName.trim(), price: effectivePrice }
      : undefined;
    onApply(discount, notes.trim(), customUpdate);
    onClose();
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Item settings"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>{itemName}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form className={styles.body} onSubmit={handleSubmit}>
          {isCustom && (
            <>
              <div className={styles.field}>
                <label htmlFor="custom-item-name">Name</label>
                <input
                  id="custom-item-name"
                  className={styles.textInput}
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Magic Sword"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="custom-item-price">Price</label>
                <div className={styles.inputRow}>
                  <input
                    id="custom-item-price"
                    type="number"
                    min="0"
                    step="any"
                    value={customPriceAmount}
                    onChange={(e) => setCustomPriceAmount(e.target.value)}
                    placeholder="0"
                  />
                  <select
                    className={styles.denomSelect}
                    value={customPriceDenom}
                    onChange={(e) =>
                      setCustomPriceDenom(e.target.value as PriceDenomination)
                    }
                    aria-label="Price denomination"
                  >
                    <option value="gp">gp</option>
                    <option value="sp">sp</option>
                    <option value="cp">cp</option>
                  </select>
                </div>
              </div>
            </>
          )}
          <div className={styles.field}>
            <label htmlFor="discount-amount">Discount per item</label>
            <div className={styles.inputRow}>
              <input
                id="discount-amount"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
              <select
                className={styles.denomSelect}
                value={denomination}
                onChange={(e) =>
                  setDenomination(e.target.value as Denomination)
                }
                aria-label="Currency denomination"
              >
                <option value="gp">gp</option>
                <option value="%">%</option>
              </select>
            </div>
          </div>
          {discountError && (
            <p className={styles.fieldError} role="alert">
              {discountError}
            </p>
          )}
          {isValid && discountCp > 0 && (
            <p className={styles.preview}>
              {formatPrice(effectivePrice)} →{" "}
              <span className={styles.previewPrice}>
                {formatPrice(discountedPrice)}
              </span>
            </p>
          )}
          <div className={styles.field}>
            <label htmlFor="item-notes">Notes</label>
            <input
              ref={notesRef}
              id="item-notes"
              className={styles.textInput}
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. why this is a cool item for your character"
            />
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.applyBtn}
              disabled={!isValid}
            >
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
