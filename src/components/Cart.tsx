import { useCallback, useEffect, useRef, useState } from "react";
import type { CartEntry } from "../hooks/useCart";
import { aonUrl } from "../lib/aon";
import { formatPrice } from "../lib/price";
import type { Price } from "../types";

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
    <div className="share-backdrop" onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: click stop propagation */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: modal container */}
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <p className="share-title">Share this cart</p>
        <div className="share-url-row">
          <input
            ref={inputRef}
            className="share-url-input"
            type="text"
            value={url}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <button type="button" className="share-copy-btn" onClick={handleCopy}>
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
    <div className="cart">
      <div className="cart-header">
        <h2>Cart ({totalItems})</h2>
        {entries.length > 0 && (
          <div className="cart-header-actions">
            <button
              type="button"
              className="share-btn"
              onClick={() => setShowShare(true)}
            >
              Share
            </button>
            <button type="button" className="clear-btn" onClick={onClear}>
              Clear
            </button>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="cart-empty">
          Add items from the table to start building your loadout.
        </p>
      ) : (
        <ul className="cart-items">
          {entries.map((entry) => (
            <li key={entry.item.id} className="cart-item">
              <div className="cart-item-info">
                <a
                  className="cart-item-name"
                  href={aonUrl(entry.item)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {entry.item.name}
                </a>
                <span className="cart-item-price">
                  {formatPrice(entry.item.price)}
                  {entry.quantity > 1 && " each"}
                </span>
              </div>
              <div className="cart-item-controls">
                <button
                  type="button"
                  onClick={() =>
                    onSetQuantity(entry.item.id, entry.quantity - 1)
                  }
                >
                  −
                </button>
                <span className="cart-item-qty">{entry.quantity}</span>
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
                  className="remove-btn"
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
        <div className="cart-total">
          <span>Total:</span>
          <strong>{formatPrice(totalPrice)}</strong>
        </div>
      )}

      {showShare && <ShareModal onClose={() => setShowShare(false)} />}
    </div>
  );
}
