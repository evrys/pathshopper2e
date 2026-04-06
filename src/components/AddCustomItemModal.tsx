import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import { CP_PER } from "../lib/price";
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

  const parsedAmount = priceAmount === "" ? 0 : Number(priceAmount);
  const isValid =
    name.trim().length > 0 &&
    (priceAmount === "" || Number.isFinite(parsedAmount)) &&
    Number.isInteger(parsedAmount * CP_PER[denomination]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const price: Price =
      parsedAmount !== 0 ? { [denomination]: parsedAmount } : {};

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
      sourceId: "",
      sourceCategory: "",
      remaster: false,
      description: "",
      plainDescription: "",
    };

    onAdd(item);
    onClose();
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.panel}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            nameInputRef.current?.focus();
          }}
        >
          <div className={styles.panelHeader}>
            <Dialog.Title asChild>
              <h2>Add Custom Item</h2>
            </Dialog.Title>
            <Dialog.Close className={styles.closeBtn} aria-label="Close">
              ✕
            </Dialog.Close>
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
                  step="any"
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
              <button
                type="submit"
                className={styles.addBtn}
                disabled={!isValid}
              >
                Add Item
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
