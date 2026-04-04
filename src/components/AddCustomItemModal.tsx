import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Item, Price } from "../types";
import styles from "./AddCustomItemModal.module.css";

type Denomination = "gp" | "sp" | "cp";

interface AddCustomItemModalProps {
  onAdd: (item: Item) => void;
  onClose: () => void;
}

let customItemCounter = 0;

export function AddCustomItemModal({
  onAdd,
  onClose,
}: AddCustomItemModalProps) {
  const [name, setName] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [denomination, setDenomination] = useState<Denomination>("gp");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const parsedAmount = priceAmount === "" ? 0 : Number(priceAmount);
  const isValid =
    name.trim().length > 0 && (priceAmount === "" || parsedAmount >= 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const price: Price =
      parsedAmount > 0 ? { [denomination]: parsedAmount } : {};

    const item: Item = {
      id: `custom-${++customItemCounter}-${Date.now()}`,
      name: name.trim(),
      type: "equipment",
      level: 0,
      price: price,
      category: "Custom",
      traits: [],
      rarity: "common",
      bulk: 0,
      usage: "",
      source: "Custom",
      remaster: false,
      description: "",
      plainDescription: "",
    };

    onAdd(item);
    onClose();
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Add custom item"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Add Custom Item</h2>
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
            <label htmlFor="custom-item-name">Name</label>
            <input
              ref={nameInputRef}
              id="custom-item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Magic Sword"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="custom-item-price">Price</label>
            <div className={styles.priceRow}>
              <input
                id="custom-item-price"
                type="number"
                min="0"
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
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
              </select>
            </div>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className={styles.addBtn} disabled={!isValid}>
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
