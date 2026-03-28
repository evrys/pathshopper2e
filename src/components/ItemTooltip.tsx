import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { stripHtml } from "../lib/html";
import { formatPrice } from "../lib/price";
import type { Item } from "../types";

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

const VIEWPORT_MARGIN = 8;

/** Clamp tooltip position so it stays within the viewport. */
function useClampedPosition(anchor: DOMRect | null) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) {
      setPos(null);
      return;
    }

    const el = tooltipRef.current;
    if (!el) {
      setPos({ top: anchor.bottom + 4, left: anchor.left });
      return;
    }

    const rect = el.getBoundingClientRect();
    let top = anchor.bottom + 4;
    let left = anchor.left;

    // If it overflows the bottom, flip above the anchor
    if (top + rect.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = anchor.top - rect.height - 4;
    }

    // Clamp horizontally
    if (left + rect.width > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - rect.width - VIEWPORT_MARGIN;
    }
    if (left < VIEWPORT_MARGIN) {
      left = VIEWPORT_MARGIN;
    }

    // Clamp top as a last resort
    if (top < VIEWPORT_MARGIN) {
      top = VIEWPORT_MARGIN;
    }

    setPos({ top, left });
  }, [anchor]);

  return { tooltipRef, pos };
}

export function ItemTooltip({
  item,
  anchor,
}: {
  item: Item | null;
  anchor: DOMRect | null;
}) {
  const { tooltipRef, pos } = useClampedPosition(item ? anchor : null);

  if (!item || !anchor) return null;

  const price = formatPrice(item.price);
  const description = item.description ? stripHtml(item.description) : null;
  const headerBg =
    RARITY_HEADER_COLORS[item.rarity] ?? RARITY_HEADER_COLORS.common;

  return createPortal(
    <div
      ref={tooltipRef}
      className="item-tooltip"
      style={{
        top: pos?.top ?? anchor.bottom + 4,
        left: pos?.left ?? anchor.left,
        visibility: pos ? "visible" : "hidden",
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
