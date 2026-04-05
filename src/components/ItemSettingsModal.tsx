import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CP_PER, formatPrice, fromCopper, toCopper } from "../lib/price";
import type { UpgradeOption } from "../lib/variants";
import type { Price, PriceModifier } from "../types";
import styles from "./ItemSettingsModal.module.css";

/**
 * Preset value for the "Price modifier" dropdown.
 * - "none": no modifier
 * - "crafting": 50% discount
 * - "upgrade-N": flat discount equal to the Nth upgrade option's price
 * - "custom-gp": manual flat gp input
 * - "custom-percent": manual % input
 */
type ModifierPreset = string;

/** Convert a flat copper amount into a gp amount. */
function cpToGp(cp: number): number {
  return cp / CP_PER.gp;
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

/** Determine the initial preset from an existing price modifier and available upgrade options. */
function initPreset(
  modifier: PriceModifier,
  upgradeOptions: UpgradeOption[],
): { preset: ModifierPreset; amount: string } {
  if (modifier.type === "crafting") {
    return { preset: "crafting", amount: "" };
  }
  if (modifier.type === "percent") {
    return { preset: "custom-percent", amount: String(modifier.percent) };
  }
  if (modifier.type === "upgrade") {
    // Match against upgrade options by copper value
    for (let i = 0; i < upgradeOptions.length; i++) {
      if (upgradeOptions[i].priceCp === modifier.cp) {
        return { preset: `upgrade-${i}`, amount: "" };
      }
    }
    // Fallback: upgrade option no longer available, show as custom gp discount
    return { preset: "custom-gp", amount: String(-cpToGp(modifier.cp)) };
  }
  return { preset: "custom-gp", amount: String(cpToGp(modifier.cp)) };
}

interface ItemSettingsModalProps {
  itemName: string;
  price: Price;
  /** Whether this is a custom item whose name/price can be edited. */
  isCustom?: boolean;
  /** Current price modifier, if any. */
  currentModifier?: PriceModifier;
  /** Current notes, if any. */
  currentNotes?: string;
  /** Cheaper variants this item can be upgraded from. */
  upgradeOptions?: UpgradeOption[];
  /** Called with the new price modifier, notes, and optional custom item updates. */
  onApply: (
    priceModifier: PriceModifier | undefined,
    notes: string,
    customUpdate?: { name: string; price: Price },
  ) => void;
  onClose: () => void;
}

export function ItemSettingsModal({
  itemName,
  price,
  isCustom,
  currentModifier,
  currentNotes,
  upgradeOptions = [],
  onApply,
  onClose,
}: ItemSettingsModalProps) {
  const init = currentModifier
    ? initPreset(currentModifier, upgradeOptions)
    : null;
  const [preset, setPreset] = useState<ModifierPreset>(init?.preset ?? "none");
  const [amount, setAmount] = useState(init?.amount ?? "");
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

  const isCustomInput = preset === "custom-gp" || preset === "custom-percent";

  // Effective price: use custom price fields when editing a custom item
  const parsedCustomPrice =
    customPriceAmount === "" ? 0 : Number(customPriceAmount);
  const effectivePrice =
    isCustom && parsedCustomPrice > 0
      ? ({ [customPriceDenom]: parsedCustomPrice } as Price)
      : isCustom
        ? ({} as Price)
        : price;

  // Compute the price adjustment in copper based on preset
  // Positive = price increase (surcharge), negative = price decrease (discount)
  const parsed = amount === "" ? 0 : Number(amount);
  const adjustCp = (() => {
    if (preset === "none") return 0;
    if (preset === "crafting") {
      return -Math.round(0.5 * toCopper(effectivePrice));
    }
    if (preset.startsWith("upgrade-")) {
      const idx = Number(preset.slice("upgrade-".length));
      return -(upgradeOptions[idx]?.priceCp ?? 0);
    }
    // custom-gp or custom-percent
    if (!Number.isFinite(parsed)) return 0;
    if (preset === "custom-percent") {
      return Math.round((parsed / 100) * toCopper(effectivePrice));
    }
    return parsed * CP_PER.gp;
  })();

  const priceCp = toCopper(effectivePrice);
  const customPriceCp = parsedCustomPrice * CP_PER[customPriceDenom];

  const isValid = (() => {
    if (isCustom && customName.trim().length === 0) return false;
    if (isCustom && !Number.isInteger(customPriceCp)) return false;
    if (preset === "none") return true;
    if (preset === "crafting" || preset.startsWith("upgrade-")) {
      return -adjustCp <= priceCp;
    }
    // Custom input validation — allow any finite number (positive = surcharge, negative = discount)
    return Number.isFinite(parsed) && Number.isInteger(adjustCp);
  })();

  const modifiedPrice = fromCopper(Math.max(0, priceCp + adjustCp));

  // Compute a user-facing error for the custom input field
  const inputError = (() => {
    if (!isCustomInput || amount === "" || parsed === 0) return undefined;
    if (!Number.isFinite(parsed)) return "Must be a number";
    if (preset === "custom-gp" && !Number.isInteger(adjustCp))
      return "Must be a whole number of copper pieces";
    return undefined;
  })();

  function handlePresetChange(value: string) {
    setPreset(value);
    // Reset custom amount when switching presets
    if (value !== "custom-gp" && value !== "custom-percent") {
      setAmount("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    let priceModifier: PriceModifier | undefined;
    if (adjustCp === 0) {
      priceModifier = undefined;
    } else if (preset === "crafting") {
      priceModifier = { type: "crafting" };
    } else if (preset === "custom-percent") {
      priceModifier = { type: "percent", percent: parsed };
    } else if (preset.startsWith("upgrade-")) {
      priceModifier = { type: "upgrade", cp: -adjustCp };
    } else {
      priceModifier = { type: "flat", cp: adjustCp };
    }
    const customUpdate = isCustom
      ? { name: customName.trim(), price: effectivePrice }
      : undefined;
    onApply(priceModifier, notes.trim(), customUpdate);
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
            <label htmlFor="modifier-preset">Price modifier</label>
            <select
              id="modifier-preset"
              className={styles.presetSelect}
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              <option value="none">None</option>
              {upgradeOptions.map((opt, i) => (
                <option key={opt.name} value={`upgrade-${i}`}>
                  Upgrade from {opt.name} (-{opt.priceDisplay})
                </option>
              ))}
              <option value="crafting">Crafting (-50%)</option>
              <option value="custom-gp">Custom (gp)</option>
              <option value="custom-percent">Custom (%)</option>
            </select>
          </div>
          {isCustomInput && (
            <div className={styles.field}>
              <label htmlFor="modifier-amount">Amount per item</label>
              <input
                id="modifier-amount"
                className={styles.textInput}
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          )}
          {inputError && (
            <p className={styles.fieldError} role="alert">
              {inputError}
            </p>
          )}
          {isValid && adjustCp !== 0 && (
            <p className={styles.preview}>
              {formatPrice(effectivePrice)} →{" "}
              <span className={styles.previewPrice}>
                {formatPrice(modifiedPrice)}
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
