import { useEffect, useRef, useState } from "react";
import type { CartEntry } from "../hooks/useCart";
import { useMediaQuery } from "../hooks/useMediaQuery";
import type { SavedList } from "../hooks/useSavedLists";
import { aonUrl } from "../lib/aon";
import { entriesToCsv } from "../lib/csv";
import { formatPrice } from "../lib/price";
import {
  buildCustomIdMap,
  buildHashString,
  serializeCart,
  serializeCustomItems,
  serializeNotes,
} from "../lib/url";
import type { Discount, Price } from "../types";
import { AddCustomItemModal } from "./AddCustomItemModal";
import styles from "./Cart.module.css";
import { ItemSettingsModal } from "./ItemSettingsModal";
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
  onSetDiscount: (itemId: string, discount: Discount | undefined) => void;
  onSetNotes: (itemId: string, notes: string) => void;
  onUpdateItem: (
    itemId: string,
    update: { name?: string; price?: Price },
  ) => void;
  onAddItem: (item: CartEntry["item"]) => void;
  onLoadList: (list: SavedList) => void;
  onNewList: (name: string, copyItems?: boolean) => void;
  onDeleteList: (id: string) => void;
  /** Import CSV. If commit is false, returns matched item count without modifying cart. */
  onImportCsv: (csv: string, commit: boolean) => number;
}

/** Build a share URL pointing to the readonly list view with cart + list name in the hash. */
function buildShareUrl(
  entries: CartEntry[],
  charName: string,
  listId: string,
): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const params = new URLSearchParams();

  if (charName) params.set("name", charName);
  params.set("lid", listId);

  if (entries.length > 0) {
    // Build a stable id mapping for custom items so the share URL
    // uses `custom-0`, `custom-1`, … which parseCustomItems will produce.
    const idMap = buildCustomIdMap(entries);

    const cart = new Map(
      entries.map(({ item, quantity }) => [
        idMap.get(item.id) ?? item.id,
        quantity,
      ]),
    );

    // Collect per-item discounts keyed by share-URL id
    const discountMap = new Map<string, Discount>();
    for (const { item, discount } of entries) {
      if (discount) {
        discountMap.set(idMap.get(item.id) ?? item.id, discount);
      }
    }

    // Collect per-item notes keyed by share-URL id
    const notesMap = new Map<string, string>();
    for (const { item, notes } of entries) {
      if (notes) {
        notesMap.set(idMap.get(item.id) ?? item.id, notes);
      }
    }

    params.set("items", serializeCart(cart, discountMap));

    const customEntries = entries.filter((e) =>
      e.item.id.startsWith("custom-"),
    );
    if (customEntries.length > 0) {
      params.set("custom", serializeCustomItems(customEntries));
    }

    if (notesMap.size > 0) {
      params.set("notes", serializeNotes(notesMap, idMap));
    }
  }

  return `${window.location.origin}${base}/?view=list${buildHashString(params)}`;
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
  onSetDiscount,
  onSetNotes,
  onUpdateItem,
  onAddItem,
  onLoadList,
  onNewList,
  onDeleteList,
  onImportCsv,
}: CartProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [mobileCollapsed, setMobileCollapsed] = useState(true);
  const [listsOpen, setListsOpen] = useState(false);
  const [listsOpenCreating, setListsOpenCreating] = useState(false);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [discountEntry, setDiscountEntry] = useState<CartEntry | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const expanded = !isMobile || !mobileCollapsed;
  const title = listName || "My shopping list";

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

  function handleExportCsv() {
    const csv = entriesToCsv(entries);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${listName || "shopping-list"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const csv = reader.result;
      const count = onImportCsv(csv, false);
      if (count === 0) {
        alert("No matching items found in the CSV file.");
        return;
      }
      const ok = window.confirm(
        `Replace your current list with ${count} item${count !== 1 ? "s" : ""} from the CSV?`,
      );
      if (ok) {
        onImportCsv(csv, true);
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = "";
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
            href={buildShareUrl(entries, listName, activeListId)}
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
              <hr className={styles.menuDivider} />
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  setCustomItemOpen(true);
                }}
              >
                Add custom item
              </button>
              <hr className={styles.menuDivider} />
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  handleExportCsv();
                }}
              >
                Export CSV
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  csvInputRef.current?.click();
                }}
              >
                Import CSV
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
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={handleImportCsvFile}
      />
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

          {customItemOpen && (
            <AddCustomItemModal
              onAdd={onAddItem}
              onClose={() => setCustomItemOpen(false)}
            />
          )}

          {discountEntry && (
            <ItemSettingsModal
              itemName={discountEntry.item.name}
              price={discountEntry.item.price}
              isCustom={discountEntry.item.id.startsWith("custom-")}
              currentDiscount={discountEntry.discount}
              currentNotes={discountEntry.notes}
              onApply={(discount, notes, customUpdate) => {
                onSetDiscount(discountEntry.item.id, discount);
                onSetNotes(discountEntry.item.id, notes);
                if (customUpdate) {
                  onUpdateItem(discountEntry.item.id, customUpdate);
                }
              }}
              onClose={() => setDiscountEntry(null)}
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
                    {entry.item.id.startsWith("custom-") ? (
                      <span className={styles.itemName}>{entry.item.name}</span>
                    ) : (
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
                    )}
                    <span className={styles.itemPrice}>
                      {entry.discount ? (
                        <>
                          <span className={styles.originalPrice}>
                            {formatPrice(entry.item.price)}
                          </span>{" "}
                          {formatPrice(entry.item.price, entry.discount)}
                        </>
                      ) : (
                        formatPrice(entry.item.price)
                      )}
                      {entry.quantity > 1 && " each"}
                    </span>
                    {entry.notes && (
                      <span className={styles.itemNotes}>{entry.notes}</span>
                    )}
                  </div>
                  <div className={styles.controls}>
                    <button
                      type="button"
                      className={styles.settingsBtn}
                      onClick={() => setDiscountEntry(entry)}
                      title="Item settings"
                    >
                      ✏️
                    </button>
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
