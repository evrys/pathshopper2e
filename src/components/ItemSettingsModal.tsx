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

interface ItemSettingsModalProps {
  itemName: string;
  price: Price;
  /** Current discount, if any. */
  currentDiscount?: Discount;
  /** Current notes, if any. */
  currentNotes?: string;
  /** Called with the new discount, or undefined to clear. */
  onApply: (discount: Discount | undefined, notes: string) => void;
  onClose: () => void;
}

export function ItemSettingsModal({
  itemName,
  price,
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
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
  const discountCp = !Number.isFinite(parsed)
    ? 0
    : isPercent
      ? Math.round((parsed / 100) * toCopper(price))
      : parsed * CP_PER[denomination];
  const priceCp = toCopper(price);
  const isValid =
    Number.isFinite(parsed) &&
    parsed >= 0 &&
    discountCp <= priceCp &&
    (!isPercent || parsed <= 100);
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
    onApply(discount, notes.trim());
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
          <div className={styles.field}>
            <label htmlFor="discount-amount">Discount per item</label>
            <div className={styles.inputRow}>
              <input
                ref={inputRef}
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
              {formatPrice(price)} →{" "}
              <span className={styles.previewPrice}>
                {formatPrice(discountedPrice)}
              </span>
            </p>
          )}
          <div className={styles.field}>
            <label htmlFor="item-notes">Notes</label>
            <textarea
              id="item-notes"
              className={styles.notesInput}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Buy from Trader Joe in Absalom"
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
