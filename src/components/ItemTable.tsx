import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useFuzzySearch } from "../hooks/useFuzzySearch";
import { aonUrl } from "../lib/aon";
import { formatPrice, toCopper } from "../lib/price";
import type { Item } from "../types";
import { ItemTooltip, useItemTooltip } from "./ItemTooltip";
import { MultiSelect } from "./MultiSelect";

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

const ITEMS_PER_PAGE = 50;

const TYPE_LABELS: Record<string, string> = {
  weapon: "⚔️ Weapon",
  armor: "🛡️ Armor",
  shield: "🛡️ Shield",
  equipment: "🎒 Equipment",
  consumable: "🧪 Consumable",
  treasure: "💎 Treasure",
  backpack: "👜 Container",
  kit: "📦 Kit",
};

const RARITY_COLORS: Record<string, string> = {
  common: "inherit",
  uncommon: "#e07020",
  rare: "#2060d0",
  unique: "#8020a0",
};

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
  const [page, setPage] = useState(0);
  const { tooltip, show: showTooltip, hide: hideTooltip } = useItemTooltip();

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
  const fuzzyResults = useFuzzySearch(preFiltered, getName, search);

  // Build a Map from item id → highlighted ReactNode for rendering
  const highlightMap = useMemo(() => {
    const map = new Map<string, ReactNode>();
    for (const r of fuzzyResults) {
      if (r.highlighted) {
        map.set(r.item.id, r.highlighted);
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

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const pageItems = sorted.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE,
  );

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

  // Reset page when filters change
  const resetPage = () => setPage(0);

  return (
    <div className="item-table-container">
      <div className="item-filters">
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => {
            onFiltersChange({ search: e.target.value });
            resetPage();
          }}
          className="search-input"
        />
        <MultiSelect
          placeholder="All Types"
          options={Object.entries(TYPE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          selected={typeFilter}
          onChange={(next) => {
            onFiltersChange({ typeFilter: next });
            resetPage();
          }}
        />
        <MultiSelect
          placeholder="All Rarities"
          options={[
            { value: "common", label: "Common" },
            { value: "uncommon", label: "Uncommon" },
            { value: "rare", label: "Rare" },
            { value: "unique", label: "Unique" },
          ]}
          selected={rarityFilter}
          onChange={(next) => {
            onFiltersChange({ rarityFilter: next });
            resetPage();
          }}
        />
        <input
          type="number"
          placeholder="Min Lvl"
          value={minLevel}
          onChange={(e) => {
            onFiltersChange({ minLevel: e.target.value });
            resetPage();
          }}
          className="level-input"
          min={0}
          max={30}
        />
        <input
          type="number"
          placeholder="Max Lvl"
          value={maxLevel}
          onChange={(e) => {
            onFiltersChange({ maxLevel: e.target.value });
            resetPage();
          }}
          className="level-input"
          min={0}
          max={30}
        />
        <span className="result-count">{sorted.length} items</span>
      </div>

      <div className="item-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort("name")}>
                Name{sortIndicator("name")}
              </th>
              <th className="sortable" onClick={() => handleSort("type")}>
                Type{sortIndicator("type")}
              </th>
              <th className="sortable" onClick={() => handleSort("level")}>
                Lvl{sortIndicator("level")}
              </th>
              <th className="sortable" onClick={() => handleSort("price")}>
                Price{sortIndicator("price")}
              </th>
              <th>Rarity</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => (
              <tr key={item.id}>
                <td
                  className="item-name"
                  onMouseEnter={(e) => showTooltip(item, e.currentTarget)}
                  onMouseLeave={hideTooltip}
                >
                  <a
                    href={aonUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {highlightMap.get(item.id) ?? item.name}
                  </a>
                </td>
                <td className="item-type">
                  {TYPE_LABELS[item.type] ?? item.type}
                </td>
                <td className="item-level">{item.level}</td>
                <td className="item-price">{formatPrice(item.price)}</td>
                <td
                  className="item-rarity"
                  style={{ color: RARITY_COLORS[item.rarity] ?? "inherit" }}
                >
                  {item.rarity}
                </td>
                <td className="item-actions">
                  <button
                    type="button"
                    className="add-btn"
                    onClick={() => onAddItem(item)}
                    title={`Add ${item.name} to cart`}
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={6} className="no-results">
                  No items match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      <ItemTooltip
        item={tooltip?.item ?? null}
        anchor={tooltip?.rect ?? null}
      />
    </div>
  );
}
