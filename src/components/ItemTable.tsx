import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFuzzySearch } from "../hooks/useFuzzySearch";
import { aonUrl } from "../lib/aon";
import { formatPrice, toCopper } from "../lib/price";
import type { Item } from "../types";
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

/** Strip HTML tags and decode common entities for tooltip text. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncate text to a max length, appending "…" if needed. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** Format a kebab-case usage string into a human-readable label. */
function formatUsage(usage: string): string {
  return usage
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bIn\b/g, "in")
    .replace(/\bOr\b/g, "or")
    .replace(/\bA\b/g, "a")
    .replace(/\bAn\b/g, "an")
    .replace(/\bOf\b/g, "of")
    .replace(/\bTo\b/g, "to")
    .replace(/\bOn\b/g, "on")
    .replace(/\bThe\b/g, "the")
    .replace(/\bWo\b/g, "w/o")
    .replace(/\bWith\b/g, "with")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Format a trait slug into a human-readable label. */
function formatTrait(trait: string): string {
  return trait.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const RARITY_HEADER_COLORS: Record<string, string> = {
  common: "#5b3a29",
  uncommon: "#98513d",
  rare: "#002664",
  unique: "#54166e",
};

function Tooltip({
  item,
  anchor,
}: {
  item: Item | null;
  anchor: DOMRect | null;
}) {
  if (!item || !anchor) return null;

  const price = formatPrice(item.price);
  const description = item.description
    ? truncate(stripHtml(item.description), 400)
    : null;
  const headerBg =
    RARITY_HEADER_COLORS[item.rarity] ?? RARITY_HEADER_COLORS.common;

  return createPortal(
    <div
      className="item-tooltip"
      style={{
        top: anchor.bottom + 4,
        left: anchor.left,
      }}
    >
      <div className="item-tooltip-header" style={{ background: headerBg }}>
        <span className="item-tooltip-name">{item.name}</span>
        <span className="item-tooltip-level">Item {item.level}</span>
      </div>
      <div className="item-tooltip-body">
        <div className="item-tooltip-meta">
          <span>
            <strong>Source</strong> {item.source}
          </span>
          {price !== "—" && (
            <span>
              <strong>Price</strong> {price}
            </span>
          )}
          {item.usage && (
            <span>
              <strong>Usage</strong> {formatUsage(item.usage)}
            </span>
          )}
          {item.bulk > 0 && (
            <span>
              <strong>Bulk</strong> {item.bulk < 1 ? "L" : item.bulk}
            </span>
          )}
        </div>
        {item.traits.length > 0 && (
          <div className="item-tooltip-traits">
            {item.traits.map((t) => (
              <span key={t} className="item-tooltip-trait">
                {formatTrait(t)}
              </span>
            ))}
          </div>
        )}
        {description && (
          <>
            <hr className="item-tooltip-divider" />
            <p className="item-tooltip-desc">{description}</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function useTooltip() {
  const [tooltip, setTooltip] = useState<{
    item: Item;
    rect: DOMRect;
  } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((item: Item, el: HTMLElement) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setTooltip({ item, rect: el.getBoundingClientRect() });
    }, 300);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setTooltip(null);
  }, []);

  return { tooltip, show, hide } as const;
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
  const [page, setPage] = useState(0);
  const { tooltip, show: showTooltip, hide: hideTooltip } = useTooltip();

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
            {pageItems.map((item) => {
              return (
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
              );
            })}
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

      <Tooltip item={tooltip?.item ?? null} anchor={tooltip?.rect ?? null} />
    </div>
  );
}
