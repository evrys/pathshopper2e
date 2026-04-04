import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatPrice, fromCopper, toCopper } from "../lib/price";
import type { Discount, Price } from "../types";
import styles from "./ItemSettingsModal.module.css";

type Denomination = "gp" | "sp" | "cp" | "%";

const CP_PER: Record<"gp" | "sp" | "cp", number> = {
  gp: 100,
  sp: 10,
  cp: 1,
};

/** Convert a flat copper discount into the best-fit denomination + amount. */
function cpToDenom(cp: number): { amount: number; denom: Denomination } {
  if (cp >= 100 && cp % 100 === 0) return { amount: cp / 100, denom: "gp" };
  if (cp >= 10 && cp % 10 === 0) return { amount: cp / 10, denom: "sp" };
  return { amount: cp, denom: "cp" };
}

/** Determine the initial amount + denomination from an existing Discount. */
function initFromDiscount(d: Discount): {
  amount: string;
  denom: Denomination;
} {
  if (d.type === "percent") {
    return { amount: String(d.percent), denom: "%" };
  }
  const { amount, denom } = cpToDenom(d.cp);
  return { amount: String(amount), denom };
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
  const notesRef = useRef<HTMLTextAreaElement>(null);

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
      : parsed * CP_PER[denomination];
  const priceCp = toCopper(effectivePrice);
  const isValid =
    Number.isFinite(parsed) &&
    parsed >= 0 &&
    discountCp <= priceCp &&
    (!isPercent || parsed <= 100) &&
    (!isCustom || customName.trim().length > 0);
  const discountedPrice = fromCopper(Math.max(0, priceCp - discountCp));

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
                <option value="sp">sp</option>
                <option value="cp">cp</option>
                <option value="%">%</option>
              </select>
            </div>
          </div>
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
            <textarea
              ref={notesRef}
              id="item-notes"
              className={styles.notesInput}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. why this is a cool item for your character"
              rows={3}
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
