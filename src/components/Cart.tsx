import { useRef, useState } from "react";
import type { CartEntry } from "../hooks/useCart";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { type SavedList, useSavedLists } from "../hooks/useSavedLists";
import { aonUrl } from "../lib/aon";
import { formatPrice } from "../lib/price";
import type { Price } from "../types";
import styles from "./Cart.module.css";
import { ItemTooltipWrapper } from "./ItemTooltip";
import { SavedListsModal } from "./SavedListsModal";

interface CartProps {
  entries: CartEntry[];
  totalPrice: Price;
  totalItems: number;
  charName: string;
  onCharNameChange: (name: string) => void;
  onSetQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onLoadList: (name: string, items: Map<string, number>) => void;
}

/** Build a share URL pointing to the readonly list view with cart + list name in the hash. */
function buildShareUrl(entries: CartEntry[], charName: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const params = new URLSearchParams();

  if (charName) params.set("name", charName);

  if (entries.length > 0) {
    const cartStr = entries
      .map(({ item, quantity }) =>
        quantity === 1 ? item.id : `${item.id}*${quantity}`,
      )
      .join("+");
    params.set("items", cartStr);
  }

  // Build hash without encoding `+` or `:`
  const parts: string[] = [];
  for (const [key, value] of params) {
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%2B/gi, "+")}`,
    );
  }
  const hash = parts.length > 0 ? `#${parts.join("&")}` : "";
  return `${window.location.origin}${base}/?view=list${hash}`;
}

export function Cart({
  entries,
  totalPrice,
  totalItems,
  charName,
  onCharNameChange,
  onSetQuantity,
  onRemoveItem,
  onLoadList,
}: CartProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [mobileCollapsed, setMobileCollapsed] = useState(true);
  const [listsOpen, setListsOpen] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = !isMobile || !mobileCollapsed;
  const title = charName ? charName : "Shopping List";

  const { lists, saveList, deleteList } = useSavedLists();

  const currentItems = new Map(
    entries.map(({ item, quantity }) => [item.id, quantity]),
  );

  function handleSave() {
    if (!charName.trim()) return;
    saveList(charName, currentItems);
    // Show brief "Saved!" feedback
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setSavedFeedback(true);
    feedbackTimer.current = setTimeout(() => setSavedFeedback(false), 1500);
  }

  function handleLoad(list: SavedList) {
    onLoadList(list.name, new Map(Object.entries(list.items)));
    onCharNameChange(list.name);
    setListsOpen(false);
  }

  const headerContent = (
    <>
      <h2>
        {title} ({totalItems})
      </h2>
      <div className={styles.headerActions}>
        {entries.length > 0 && (
          <a
            className={styles.shareBtn}
            href={buildShareUrl(entries, charName)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Share
          </a>
        )}
        {isMobile && (
          <span
            className={styles.collapseIcon}
            style={{
              transform: mobileCollapsed ? "rotate(-90deg)" : undefined,
            }}
            aria-hidden
          >
            ▾
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className={styles.cart}>
      {isMobile ? (
        <button
          type="button"
          className={styles.header}
          onClick={() => setMobileCollapsed((c) => !c)}
        >
          {headerContent}
        </button>
      ) : (
        <div className={styles.header}>{headerContent}</div>
      )}

      {expanded && (
        <>
          <div className={styles.charNameRow}>
            <input
              className={styles.charNameInput}
              type="text"
              placeholder="List name"
              aria-label="List name"
              value={charName}
              onChange={(e) => onCharNameChange(e.target.value)}
            />
            <div className={styles.listActions}>
              <button
                type="button"
                className={styles.listActionBtn}
                onClick={handleSave}
                disabled={!charName.trim()}
                title={charName.trim() ? "Save list" : "Enter a name to save"}
              >
                {savedFeedback ? "Saved!" : "Save"}
              </button>
              <button
                type="button"
                className={styles.listActionBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setListsOpen(true);
                }}
                disabled={lists.length === 0}
                title={
                  lists.length === 0 ? "No saved lists" : "Load a saved list"
                }
              >
                Load {lists.length > 0 && `(${lists.length})`}
              </button>
            </div>
          </div>

          {listsOpen && (
            <SavedListsModal
              lists={lists}
              onLoad={handleLoad}
              onDelete={deleteList}
              onClose={() => setListsOpen(false)}
            />
          )}

          {entries.length === 0 ? (
            <p className={styles.empty}>
              Add items from the table to start building your list.
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
        </>
      )}
    </div>
  );
}
