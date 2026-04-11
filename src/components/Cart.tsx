import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  DotsVerticalIcon,
  DragHandleDots2Icon,
} from "@radix-ui/react-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CartEntry, CartSortOrder } from "../hooks/useCart";
import { sortEntries } from "../hooks/useCart";
import { useIsMobile } from "../hooks/useMediaQuery";
import type { SavedList } from "../hooks/useSavedLists";
import { aonUrl } from "../lib/aon";
import { entriesToCsv } from "../lib/csv";
import { formatPrice, modifierLabel } from "../lib/price";
import {
  buildCustomIdMap,
  buildHashString,
  serializeCart,
  serializeCustomItems,
  serializeNotes,
} from "../lib/url";
import { getUpgradeOptions } from "../lib/variants";
import type { Item, Price, PriceModifier } from "../types";
import { AddCustomItemModal } from "./AddCustomItemModal";
import styles from "./Cart.module.css";
import { ItemSettingsModal } from "./ItemSettingsModal";
import { ItemTooltipWrapper } from "./ItemTooltip";
import { SavedListsModal } from "./SavedListsModal";

interface CartProps {
  entries: CartEntry[];
  totalPrice: Price;
  allItems: Item[];
  listName: string;
  lists: SavedList[];
  activeListId: string;
  onListNameChange: (name: string) => void;
  onSetQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onSetPriceModifier: (
    itemId: string,
    priceModifier: PriceModifier | undefined,
  ) => void;
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
  onReorder: (orderedIds: string[]) => void;
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

    // Collect per-item price modifiers keyed by share-URL id
    const modifierMap = new Map<string, PriceModifier>();
    for (const { item, priceModifier } of entries) {
      if (priceModifier) {
        modifierMap.set(idMap.get(item.id) ?? item.id, priceModifier);
      }
    }

    // Collect per-item notes keyed by share-URL id
    const notesMap = new Map<string, string>();
    for (const { item, notes } of entries) {
      if (notes) {
        notesMap.set(idMap.get(item.id) ?? item.id, notes);
      }
    }

    params.set("items", serializeCart(cart, modifierMap));

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

/** Wrapper that makes a cart list item draggable via dnd-kit. */
function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li ref={setNodeRef} style={style} className={styles.item} {...attributes}>
      <button
        type="button"
        className={styles.dragHandle}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <DragHandleDots2Icon />
      </button>
      {children}
    </li>
  );
}

export function Cart({
  entries,
  totalPrice,
  allItems,
  listName,
  lists,
  activeListId,
  onListNameChange,
  onSetQuantity,
  onRemoveItem,
  onSetPriceModifier,
  onSetNotes,
  onUpdateItem,
  onAddItem,
  onLoadList,
  onNewList,
  onDeleteList,
  onImportCsv,
  onReorder,
}: CartProps) {
  const isMobile = useIsMobile();
  const [listsOpen, setListsOpen] = useState(false);
  const [listsOpenCreating, setListsOpenCreating] = useState(false);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [settingsEntry, setSettingsEntry] = useState<CartEntry | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<CartSortOrder>("manual");
  const sortedEntries = useMemo(
    () => sortEntries(entries, sortOrder),
    [entries, sortOrder],
  );
  const sortedIds = useMemo(
    () => sortedEntries.map((e) => e.item.id),
    [sortedEntries],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedIds.indexOf(active.id as string);
    const newIndex = sortedIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...sortedIds];
    reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, active.id as string);

    // Switch to manual order when the user drags
    setSortOrder("manual");
    onReorder(reordered);
  }

  const [renaming, setRenaming] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);
  const renameCallbackRef = (el: HTMLInputElement | null) => {
    (renameRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    if (el) {
      el.focus();
      el.select();
    }
  };
  const csvInputRef = useRef<HTMLInputElement>(null);
  const title = listName || "Shopping list";

  // Track which item to flash-highlight (newly added or quantity bumped)
  const [flashId, setFlashId] = useState<string | null>(null);
  const prevEntriesRef = useRef<Map<string, number> | null>(null);
  const stableRef = useRef(false);
  const itemsListRef = useRef<HTMLUListElement>(null);

  // Mark the entries as stable after the initial hydration settles
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      stableRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const prev = prevEntriesRef.current;
    // Only flash after the initial hydration has settled
    if (prev !== null && stableRef.current) {
      for (const { item, quantity } of entries) {
        const prevQty = prev.get(item.id);
        if (prevQty === undefined || quantity > prevQty) {
          setFlashId(item.id);
          break;
        }
      }
    }
    prevEntriesRef.current = new Map(
      entries.map(({ item, quantity }) => [item.id, quantity]),
    );
  }, [entries]);

  // Scroll the flashed item into view
  useEffect(() => {
    if (!flashId || !itemsListRef.current) return;
    const el = itemsListRef.current.querySelector<HTMLElement>(
      `[data-item-id="${flashId}"]`,
    );
    if (typeof el?.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [flashId]);

  function commitRename() {
    const trimmed = renameRef.current?.value.trim() ?? "";
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
            ref={renameCallbackRef}
            className={styles.renameInput}
            type="text"
            defaultValue={listName}
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
            href={buildShareUrl(sortedEntries, listName, activeListId)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Share
          </a>
        )}
        <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={(e) => e.stopPropagation()}
              aria-label="List options"
              title="List options"
            >
              <DotsVerticalIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={styles.menuDropdown}
              side={isMobile ? "top" : undefined}
              sideOffset={4}
              align="end"
            >
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={() => {
                  setRenaming(true);
                }}
              >
                Rename
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={() => setListsOpen(true)}
              >
                Open list
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={() => {
                  setListsOpenCreating(true);
                  setListsOpen(true);
                }}
              >
                New list
              </DropdownMenu.Item>
              <DropdownMenu.Separator className={styles.menuDivider} />
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={() => setCustomItemOpen(true)}
              >
                Add custom item
              </DropdownMenu.Item>
              <DropdownMenu.Separator className={styles.menuDivider} />
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className={styles.menuItem}>
                  Sort by
                  <svg
                    className={styles.subTriggerArrow}
                    width="8"
                    height="10"
                    viewBox="0 0 8 10"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M1 1 L7 5 L1 9Z" />
                  </svg>
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent className={styles.menuDropdown}>
                    <DropdownMenu.RadioGroup
                      value={sortOrder}
                      onValueChange={(v) => setSortOrder(v as CartSortOrder)}
                    >
                      <DropdownMenu.RadioItem
                        className={`${styles.menuItem} ${styles.radioItem}`}
                        value="manual"
                      >
                        <DropdownMenu.ItemIndicator
                          className={styles.radioIndicator}
                        >
                          <CheckIcon />
                        </DropdownMenu.ItemIndicator>
                        Manual
                      </DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem
                        className={`${styles.menuItem} ${styles.radioItem}`}
                        value="level-asc"
                      >
                        <DropdownMenu.ItemIndicator
                          className={styles.radioIndicator}
                        >
                          <CheckIcon />
                        </DropdownMenu.ItemIndicator>
                        Level <ArrowUpIcon />
                      </DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem
                        className={`${styles.menuItem} ${styles.radioItem}`}
                        value="level-desc"
                      >
                        <DropdownMenu.ItemIndicator
                          className={styles.radioIndicator}
                        >
                          <CheckIcon />
                        </DropdownMenu.ItemIndicator>
                        Level <ArrowDownIcon />
                      </DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem
                        className={`${styles.menuItem} ${styles.radioItem}`}
                        value="price-asc"
                      >
                        <DropdownMenu.ItemIndicator
                          className={styles.radioIndicator}
                        >
                          <CheckIcon />
                        </DropdownMenu.ItemIndicator>
                        Price <ArrowUpIcon />
                      </DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem
                        className={`${styles.menuItem} ${styles.radioItem}`}
                        value="price-desc"
                      >
                        <DropdownMenu.ItemIndicator
                          className={styles.radioIndicator}
                        >
                          <CheckIcon />
                        </DropdownMenu.ItemIndicator>
                        Price <ArrowDownIcon />
                      </DropdownMenu.RadioItem>
                    </DropdownMenu.RadioGroup>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
              <DropdownMenu.Separator className={styles.menuDivider} />
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={handleExportCsv}
              >
                Export CSV
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={() => csvInputRef.current?.click()}
              >
                Import CSV
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
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
      <div className={styles.header}>{headerContent}</div>

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

      {settingsEntry && (
        <ItemSettingsModal
          itemName={settingsEntry.item.name}
          price={settingsEntry.item.price}
          isCustom={settingsEntry.item.id.startsWith("custom-")}
          currentModifier={settingsEntry.priceModifier}
          currentNotes={settingsEntry.notes}
          upgradeOptions={getUpgradeOptions(settingsEntry.item, allItems)}
          onApply={(priceModifier, notes, customUpdate) => {
            onSetPriceModifier(settingsEntry.item.id, priceModifier);
            onSetNotes(settingsEntry.item.id, notes);
            if (customUpdate) {
              onUpdateItem(settingsEntry.item.id, customUpdate);
            }
          }}
          onClose={() => setSettingsEntry(null)}
        />
      )}

      {entries.length === 0 ? (
        <p className={styles.empty}>
          Add items from the table to start building your list.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedIds}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.items} ref={itemsListRef}>
              {sortedEntries.map((entry) =>
                isMobile ? (
                  <SortableItem key={entry.item.id} id={entry.item.id}>
                    <div
                      data-item-id={entry.item.id}
                      className={`${styles.itemInner}${flashId === entry.item.id ? ` ${styles.flash}` : ""}`}
                      onAnimationEnd={() => setFlashId(null)}
                    >
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>
                          {entry.item.name}
                        </span>
                        <span className={styles.itemPrice}>
                          {entry.priceModifier ? (
                            <>
                              <span className={styles.originalPrice}>
                                {formatPrice(entry.item.price)}
                              </span>{" "}
                              {formatPrice(
                                entry.item.price,
                                entry.priceModifier,
                              )}
                              {modifierLabel(entry.priceModifier) &&
                                ` ${modifierLabel(entry.priceModifier)}`}
                            </>
                          ) : (
                            formatPrice(entry.item.price)
                          )}
                          {entry.quantity > 1 && " each"}
                        </span>
                        {entry.notes && (
                          <span className={styles.itemNotes}>
                            {entry.notes}
                          </span>
                        )}
                      </div>
                      <div className={styles.controls}>
                        <button
                          type="button"
                          className={styles.settingsBtn}
                          onClick={() => setSettingsEntry(entry)}
                          title="Item settings"
                        >
                          <svg
                            aria-hidden="true"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
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
                    </div>
                  </SortableItem>
                ) : (
                  <SortableItem key={entry.item.id} id={entry.item.id}>
                    <div
                      data-item-id={entry.item.id}
                      className={`${styles.itemInner}${flashId === entry.item.id ? ` ${styles.flash}` : ""}`}
                      onAnimationEnd={() => setFlashId(null)}
                    >
                      <div className={styles.itemInfo}>
                        {entry.item.id.startsWith("custom-") ? (
                          <span className={styles.itemName}>
                            {entry.item.name}
                          </span>
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
                          {entry.priceModifier ? (
                            <>
                              <span className={styles.originalPrice}>
                                {formatPrice(entry.item.price)}
                              </span>{" "}
                              {formatPrice(
                                entry.item.price,
                                entry.priceModifier,
                              )}
                              {modifierLabel(entry.priceModifier) &&
                                ` ${modifierLabel(entry.priceModifier)}`}
                            </>
                          ) : (
                            formatPrice(entry.item.price)
                          )}
                          {entry.quantity > 1 && " each"}
                        </span>
                        {entry.notes && (
                          <span className={styles.itemNotes}>
                            {entry.notes}
                          </span>
                        )}
                      </div>
                      <div className={styles.controls}>
                        <button
                          type="button"
                          className={styles.settingsBtn}
                          onClick={() => setSettingsEntry(entry)}
                          title="Item settings"
                        >
                          <svg
                            aria-hidden="true"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
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
                    </div>
                  </SortableItem>
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {entries.length > 0 && (
        <div className={styles.total}>
          <span>Total:</span>
          <strong>{formatPrice(totalPrice)}</strong>
        </div>
      )}
    </div>
  );
}
