import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useCallback, useMemo, useRef } from "react";
import { useFuzzySearch } from "../hooks/useFuzzySearch";
import { aonUrl } from "../lib/aon";
import { formatPrice, toCopper } from "../lib/price";
import { formatTrait, traitUrl } from "../lib/traits";
import type { Item } from "../types";
import { FilterModal } from "./FilterModal";
import styles from "./ItemTable.module.css";
import { ItemTooltipWrapper } from "./ItemTooltip";

type SortField = "name" | "level" | "price" | "type";
type SortDir = "asc" | "desc";

export interface FilterState {
  search: string;
  typeFilter: Set<string>;
  rarityFilter: Set<string>;
  minLevel: string;
  maxLevel: string;
  sortField: SortField;
  sortDir: SortDir;
}

interface ItemTableProps {
  items: Item[];
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  onAddItem: (item: Item) => void;
}

const TYPE_LABELS: Record<string, string> = {
  weapon: "Weapon",
  armor: "Armor",
  shield: "Shield",
  equipment: "Equipment",
  consumable: "Consumable",
  treasure: "Treasure",
  backpack: "Container",
  kit: "Kit",
};

const RARITY_COLORS: Record<string, string> = {
  common: "inherit",
  uncommon: "#e07020",
  rare: "#2060d0",
  unique: "#8020a0",
};

function TraitBadges({
  traits,
  matchedTraits,
}: {
  traits: string[];
  matchedTraits?: Set<string>;
}) {
  if (traits.length === 0) return null;
  return (
    <span className={styles.traits}>
      {traits.map((t) => {
        const label = formatTrait(t);
        const href = traitUrl(t);
        const cls = matchedTraits?.has(t) ? styles.traitMatched : styles.trait;
        return href ? (
          <a
            key={t}
            className={cls}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
        ) : (
          <span key={t} className={cls}>
            {label}
          </span>
        );
      })}
    </span>
  );
}

export function ItemTable({
  items,
  filters,
  onFiltersChange,
  onAddItem,
}: ItemTableProps) {
  const {
    search,
    typeFilter,
    rarityFilter,
    minLevel,
    maxLevel,
    sortField,
    sortDir,
  } = filters;

  const preFiltered = useMemo(() => {
    const minLvl = minLevel ? Number.parseInt(minLevel, 10) : -Infinity;
    const maxLvl = maxLevel ? Number.parseInt(maxLevel, 10) : Infinity;

    return items.filter((item) => {
      if (typeFilter.size > 0 && !typeFilter.has(item.type)) return false;
      if (rarityFilter.size > 0 && !rarityFilter.has(item.rarity)) return false;
      if (item.level < minLvl || item.level > maxLvl) return false;
      return true;
    });
  }, [items, typeFilter, rarityFilter, minLevel, maxLevel]);

  const getName = useCallback((item: Item) => item.name, []);
  const getSecondary = useCallback(
    (item: Item) =>
      item.traits.length > 0
        ? `${item.plainDescription} ${item.traits.join(" ")}`
        : item.plainDescription,
    [],
  );
  const getTraits = useCallback((item: Item) => item.traits, []);
  const fuzzyResults = useFuzzySearch(
    preFiltered,
    getName,
    search,
    getSecondary,
    getTraits,
  );

  // Build a single lookup map from item id → fuzzy search display data
  const fuzzyDataMap = useMemo(() => {
    const map = new Map<
      string,
      {
        highlighted: ReactNode | null;
        snippet: ReactNode | null;
        matchedTraits: Set<string>;
      }
    >();
    for (const r of fuzzyResults) {
      if (r.highlighted || r.secondarySnippet || r.matchedTraits.size > 0) {
        map.set(r.item.id, {
          highlighted: r.highlighted,
          snippet: r.secondarySnippet,
          matchedTraits: r.matchedTraits,
        });
      }
    }
    return map;
  }, [fuzzyResults]);

  const filtered = useMemo(
    () => fuzzyResults.map((r) => r.item),
    [fuzzyResults],
  );

  // When searching, fuzzy results are already relevance-sorted — skip column sort
  const isSearching = search.trim() !== "";

  const sorted = useMemo(() => {
    if (isSearching) return filtered;
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "level":
          return dir * (a.level - b.level);
        case "price":
          return dir * (toCopper(a.price) - toCopper(b.price));
        case "type":
          return dir * a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortField, sortDir, isSearching]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      onFiltersChange({ sortDir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      onFiltersChange({ sortField: field, sortDir: "asc" });
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const item = sorted[index];
      const data = fuzzyDataMap.get(item.id);
      const hasSnippet = !!data?.snippet;
      const hasTraits = !!data?.matchedTraits?.size;
      if (hasSnippet && hasTraits) return 72;
      if (hasSnippet || hasTraits) return 56;
      return 36;
    },
    overscan: 20,
  });

  return (
    <div className={styles.container}>
      <div className={styles.filters}>
        <span className={styles.searchWrap}>
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => {
              onFiltersChange({ search: e.target.value });
            }}
            className={styles.searchInput}
          />
          {search && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => onFiltersChange({ search: "" })}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </span>
        <FilterModal
          typeFilter={typeFilter}
          rarityFilter={rarityFilter}
          minLevel={minLevel}
          maxLevel={maxLevel}
          onFiltersChange={onFiltersChange}
        />
        <span className={styles.resultCount}>{sorted.length} items</span>
      </div>

      <div className={styles.tableScroll} ref={scrollRef}>
        <div className={styles.headerRow}>
          <button
            type="button"
            className={styles.sortable}
            onClick={() => handleSort("name")}
          >
            Name{sortIndicator("name")}
          </button>
          <button
            type="button"
            className={styles.sortable}
            onClick={() => handleSort("type")}
          >
            Type{sortIndicator("type")}
          </button>
          <button
            type="button"
            className={styles.sortable}
            onClick={() => handleSort("level")}
          >
            Lvl{sortIndicator("level")}
          </button>
          <button
            type="button"
            className={styles.sortable}
            onClick={() => handleSort("price")}
          >
            Price{sortIndicator("price")}
          </button>
          <span>Rarity</span>
          <span />
        </div>

        {sorted.length === 0 ? (
          <div className={styles.noResults}>No items match your filters.</div>
        ) : (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = sorted[virtualRow.index];
              const fuzzyData = fuzzyDataMap.get(item.id);
              const snippet = fuzzyData?.snippet;
              const matchedTraits = fuzzyData?.matchedTraits;
              return (
                <div
                  key={item.id}
                  className={styles.row}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <span className={styles.name}>
                    <ItemTooltipWrapper item={item}>
                      <a
                        href={aonUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {fuzzyData?.highlighted ?? item.name}
                      </a>
                    </ItemTooltipWrapper>
                    {snippet && (
                      <span className={styles.snippet}>{snippet}</span>
                    )}
                    {matchedTraits && matchedTraits.size > 0 && (
                      <TraitBadges
                        traits={item.traits}
                        matchedTraits={matchedTraits}
                      />
                    )}
                  </span>
                  <span>{TYPE_LABELS[item.type] ?? item.type}</span>
                  <span className={styles.level}>{item.level}</span>
                  <span className={styles.price}>
                    {formatPrice(item.price)}
                  </span>
                  <span
                    style={{
                      color: RARITY_COLORS[item.rarity] ?? "inherit",
                    }}
                  >
                    {item.rarity}
                  </span>
                  <span className={styles.actions}>
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={() => onAddItem(item)}
                      title={`Add ${item.name} to cart`}
                    >
                      +
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
