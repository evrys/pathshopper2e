import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useCallback, useMemo, useRef } from "react";
import { useFuzzySearch } from "../hooks/useFuzzySearch";
import { useIsMobile } from "../hooks/useMediaQuery";
import { aonUrl } from "../lib/aon";
import { TYPE_LABELS } from "../lib/constants";
import { formatPrice, toCopper } from "../lib/price";
import { formatTrait, traitUrl } from "../lib/traits";
import type { Item } from "../types";
import { FilterModal } from "./FilterModal";
import styles from "./ItemTable.module.css";
import { ItemTooltipWrapper, useMobileTooltip } from "./ItemTooltip";

type SortField = "name" | "level" | "price" | "type" | "rarity" | "";
type SortDir = "asc" | "desc";

export interface FilterState {
  search: string;
  typeFilter: Set<string>;
  rarityFilter: Set<string>;
  remasterFilter: Set<string>;
  traitFilter: Set<string>;
  sourceFilter: Set<string>;
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

const RARITY_COLORS: Record<string, string> = {
  common: "inherit",
  uncommon: "#e07020",
  rare: "#2060d0",
  unique: "#8020a0",
};

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  unique: 3,
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

/** Row wrapper that opens the item tooltip on any tap (mobile only). */
function MobileItemRow({
  item,
  highlighted,
  snippet,
  matchedTraits,
  onAddItem,
  style,
}: {
  item: Item;
  highlighted: ReactNode | null;
  snippet: ReactNode | null;
  matchedTraits: Set<string> | undefined;
  onAddItem: (item: Item) => void;
  style: React.CSSProperties;
}) {
  const { rowProps, portal } = useMobileTooltip(item);

  return (
    <div className={styles.row} style={style} {...rowProps}>
      <span className={styles.name}>
        <span>{highlighted ?? item.name}</span>
        {snippet && <span className={styles.snippet}>{snippet}</span>}
        {matchedTraits && matchedTraits.size > 0 && (
          <TraitBadges traits={item.traits} matchedTraits={matchedTraits} />
        )}
      </span>
      <span className={styles.colType}>
        {TYPE_LABELS[item.type] ?? item.type}
      </span>
      <span className={styles.level}>{item.level}</span>
      <span className={styles.price}>{formatPrice(item.price)}</span>
      <span
        className={styles.colRarity}
        style={{ color: RARITY_COLORS[item.rarity] ?? "inherit" }}
      >
        {item.rarity}
      </span>
      <span className={styles.actions}>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => onAddItem(item)}
          title={`Add ${item.name} to list`}
        >
          +
        </button>
      </span>
      {portal}
    </div>
  );
}

export function ItemTable({
  items,
  filters,
  onFiltersChange,
  onAddItem,
}: ItemTableProps) {
  const isMobile = useIsMobile();
  const {
    search,
    typeFilter,
    rarityFilter,
    remasterFilter,
    traitFilter,
    sourceFilter,
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
      if (
        remasterFilter.size > 0 &&
        !remasterFilter.has(item.remaster ? "remastered" : "legacy")
      )
        return false;
      if (traitFilter.size > 0 && !item.traits.some((t) => traitFilter.has(t)))
        return false;
      if (sourceFilter.size > 0 && !sourceFilter.has(item.sourceId))
        return false;
      if (item.level < minLvl || item.level > maxLvl) return false;
      return true;
    });
  }, [
    items,
    typeFilter,
    rarityFilter,
    remasterFilter,
    traitFilter,
    sourceFilter,
    minLevel,
    maxLevel,
  ]);

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

  // When no explicit column sort is selected and the user is searching,
  // preserve fuzzy relevance order. An explicit sort always takes priority.
  const isSearching = search.trim() !== "";

  const sorted = useMemo(() => {
    if (!sortField && isSearching) return filtered;
    const activeSortField = sortField || "name";
    const activeSortDir = sortField ? sortDir : "asc";
    const arr = [...filtered];
    const dir = activeSortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (activeSortField) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "level":
          return dir * (a.level - b.level);
        case "price":
          return dir * (toCopper(a.price) - toCopper(b.price));
        case "type":
          return dir * a.type.localeCompare(b.type);
        case "rarity":
          return (
            dir *
            ((RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99))
          );
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortField, sortDir, isSearching]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      if (sortDir === "asc") {
        // asc → desc
        onFiltersChange({ sortDir: "desc" });
      } else {
        // desc → cleared (no explicit sort)
        onFiltersChange({ sortField: "", sortDir: "asc" });
      }
    } else {
      onFiltersChange({ sortField: field, sortDir: "asc" });
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll position when the displayed results change
  const prevResultCount = useRef(sorted.length);
  if (sorted.length !== prevResultCount.current) {
    prevResultCount.current = sorted.length;
    scrollRef.current?.scrollTo(0, 0);
  }

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const item = sorted[index];
      const data = fuzzyDataMap.get(item.id);
      const hasSnippet = !!data?.snippet;
      const hasTraits = !!data?.matchedTraits?.size;
      if (isMobile) {
        // Two-line card layout on mobile (name + level/price row)
        if (hasSnippet && hasTraits) return 96;
        if (hasSnippet || hasTraits) return 78;
        return 54;
      }
      if (hasSnippet && hasTraits) return 72;
      if (hasSnippet || hasTraits) return 56;
      return 36;
    },
    overscan: 20,
  });

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.searchWrap}>
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => {
              onFiltersChange({ search: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
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
        <div className={styles.filters}>
          <FilterModal
            items={items}
            typeFilter={typeFilter}
            rarityFilter={rarityFilter}
            remasterFilter={remasterFilter}
            traitFilter={traitFilter}
            sourceFilter={sourceFilter}
            minLevel={minLevel}
            maxLevel={maxLevel}
            onFiltersChange={onFiltersChange}
          />
          {isMobile && (
            <select
              className={styles.sortSelect}
              value={sortField ? `${sortField}-${sortDir}` : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  onFiltersChange({ sortField: "", sortDir: "asc" });
                } else {
                  const [field, dir] = val.split("-") as [SortField, SortDir];
                  onFiltersChange({ sortField: field, sortDir: dir });
                }
              }}
              aria-label="Sort order"
            >
              <option value="">Sort: Relevance</option>
              <option value="name-asc">Name ▲</option>
              <option value="name-desc">Name ▼</option>
              <option value="level-asc">Level ▲</option>
              <option value="level-desc">Level ▼</option>
              <option value="price-asc">Price ▲</option>
              <option value="price-desc">Price ▼</option>
              <option value="type-asc">Type ▲</option>
              <option value="type-desc">Type ▼</option>
              <option value="rarity-asc">Rarity ▲</option>
              <option value="rarity-desc">Rarity ▼</option>
            </select>
          )}
          <span className={styles.resultCount}>{sorted.length} items</span>
        </div>
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
            className={`${styles.sortable} ${styles.colType}`}
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
          <button
            type="button"
            className={`${styles.sortable} ${styles.colRarity}`}
            onClick={() => handleSort("rarity")}
          >
            Rarity{sortIndicator("rarity")}
          </button>
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
              const snippet = fuzzyData?.snippet ?? null;
              const matchedTraits = fuzzyData?.matchedTraits;
              const rowStyle: React.CSSProperties = {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              };

              if (isMobile) {
                return (
                  <MobileItemRow
                    key={item.id}
                    item={item}
                    highlighted={fuzzyData?.highlighted ?? null}
                    snippet={snippet}
                    matchedTraits={matchedTraits}
                    onAddItem={onAddItem}
                    style={rowStyle}
                  />
                );
              }

              return (
                <div key={item.id} className={styles.row} style={rowStyle}>
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
                  <span className={styles.colType}>
                    {TYPE_LABELS[item.type] ?? item.type}
                  </span>
                  <span className={styles.level}>{item.level}</span>
                  <span className={styles.price}>
                    {formatPrice(item.price)}
                  </span>
                  <span
                    className={styles.colRarity}
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
                      title={`Add ${item.name} to list`}
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
