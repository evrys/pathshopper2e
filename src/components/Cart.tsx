import { useEffect, useRef, useState } from "react";
import type { CartEntry } from "../hooks/useCart";
import { useMediaQuery } from "../hooks/useMediaQuery";
import type { SavedList } from "../hooks/useSavedLists";
import { aonUrl } from "../lib/aon";
import { formatPrice } from "../lib/price";
import type { Price } from "../types";
import styles from "./Cart.module.css";
import { ItemTooltipWrapper } from "./ItemTooltip";
import { SavedListsModal } from "./SavedListsModal";

interface CartProps {
  entries: CartEntry[];
  totalPrice: Price;
  listName: string;
  lists: SavedList[];
  activeListId: string;
  onListNameChange: (name: string) => void;
  onSetQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onLoadList: (list: SavedList) => void;
  onNewList: (name: string) => void;
  onDeleteList: (id: string) => void;
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
  listName,
  lists,
  activeListId,
  onListNameChange,
  onSetQuantity,
  onRemoveItem,
  onLoadList,
  onNewList,
  onDeleteList,
}: CartProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [mobileCollapsed, setMobileCollapsed] = useState(true);
  const [listsOpen, setListsOpen] = useState(false);
  const [listsOpenCreating, setListsOpenCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const expanded = !isMobile || !mobileCollapsed;
  const title = listName || "Shopping List";

  // Close the dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== listName) {
      onListNameChange(trimmed);
    }
    setRenaming(false);
  }

  function handleLoad(list: SavedList) {
    onLoadList(list);
    setListsOpen(false);
  }

  const headerContent = (
    <>
      {renaming ? (
        <form
          className={styles.renameForm}
          onSubmit={(e) => {
            e.preventDefault();
            commitRename();
          }}
        >
          <input
            ref={renameInputRef}
            className={styles.renameInput}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setRenaming(false);
              }
            }}
            aria-label="Rename list"
          />
        </form>
      ) : (
        <h2>{title}</h2>
      )}
      <div className={styles.headerActions}>
        {entries.length > 0 && (
          <a
            className={styles.shareBtn}
            href={buildShareUrl(entries, listName)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Share
          </a>
        )}
        <div className={styles.menuWrapper} ref={menuRef}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            aria-label="List options"
            title="List options"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className={styles.menuDropdown}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  setRenameValue(listName);
                  setRenaming(true);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  setListsOpen(true);
                }}
              >
                Open list
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  setListsOpenCreating(true);
                  setListsOpen(true);
                }}
              >
                New list
              </button>
            </div>
          )}
        </div>
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
          {listsOpen && (
            <SavedListsModal
              lists={lists}
              activeListId={activeListId}
              initialCreatingNew={listsOpenCreating}
              onLoad={handleLoad}
              onDelete={onDeleteList}
              onNewList={onNewList}
              onClose={() => {
                setListsOpen(false);
                setListsOpenCreating(false);
              }}
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
