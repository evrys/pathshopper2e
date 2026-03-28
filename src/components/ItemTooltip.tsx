import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatPrice } from "../lib/price";
import type { Item } from "../types";

/** Strip HTML tags and decode common entities for plain text. */
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

export function ItemTooltip({
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

export function useItemTooltip() {
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
