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

export function Cart({
  entries,
  totalPrice,
  totalItems,
  onSetQuantity,
  onRemoveItem,
  onClear,
}: CartProps) {
  return (
    <div className="cart">
      <div className="cart-header">
        <h2>Cart ({totalItems})</h2>
        {entries.length > 0 && (
          <button type="button" className="clear-btn" onClick={onClear}>
            Clear
          </button>
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
    </div>
  );
}
