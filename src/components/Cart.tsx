import { useCallback, useEffect, useRef, useState } from "react";
import type { CartEntry } from "../hooks/useCart";
import { aonUrl } from "../lib/aon";
import { formatPrice } from "../lib/price";
import type { Price } from "../types";
import styles from "./Cart.module.css";
import { ItemTooltipWrapper } from "./ItemTooltip";

interface CartProps {
  entries: CartEntry[];
  totalPrice: Price;
  totalItems: number;
  onSetQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClear: () => void;
}

function ShareModal({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const url = window.location.href;

  // Select the URL text on mount
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [url]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to dismiss
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop is a dismiss target
    <div className={styles.backdrop} onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: click stop propagation */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: modal container */}
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.modalTitle}>Share this list</p>
        <div className={styles.urlRow}>
          <input
            ref={inputRef}
            className={styles.urlInput}
            type="text"
            value={url}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <button type="button" className={styles.copyBtn} onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Cart({
  entries,
  totalPrice,
  totalItems,
  onSetQuantity,
  onRemoveItem,
  onClear,
}: CartProps) {
  const [showShare, setShowShare] = useState(false);

  return (
    <div className={styles.cart}>
      <div className={styles.header}>
        <h2>Shopping List ({totalItems})</h2>
        {entries.length > 0 && (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.shareBtn}
              onClick={() => setShowShare(true)}
            >
              Share
            </button>
            <button type="button" className={styles.clearBtn} onClick={onClear}>
              Clear
            </button>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <p className={styles.empty}>
          Add items from the table to start building your loadout.
        </p>
      ) : (
        <ul className={styles.items}>
          {entries.map((entry) => (
            <li key={entry.item.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <ItemTooltipWrapper item={entry.item}>
                  <a
                    className={styles.itemName}
                    href={aonUrl(entry.item)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {entry.item.name}
                  </a>
                </ItemTooltipWrapper>
                <span className={styles.itemPrice}>
                  {formatPrice(entry.item.price)}
                  {entry.quantity > 1 && " each"}
                </span>
              </div>
              <div className={styles.controls}>
                <button
                  type="button"
                  onClick={() =>
                    onSetQuantity(entry.item.id, entry.quantity - 1)
                  }
                >
                  −
                </button>
                <span className={styles.qty}>{entry.quantity}</span>
                <button
                  type="button"
                  onClick={() =>
                    onSetQuantity(entry.item.id, entry.quantity + 1)
                  }
                >
                  +
                </button>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => onRemoveItem(entry.item.id)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <div className={styles.total}>
          <span>Total:</span>
          <strong>{formatPrice(totalPrice)}</strong>
        </div>
      )}

      {showShare && <ShareModal onClose={() => setShowShare(false)} />}
    </div>
  );
}
