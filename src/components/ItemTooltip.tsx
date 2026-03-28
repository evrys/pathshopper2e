import Tippy from "@tippyjs/react";
import type { ReactElement } from "react";
import "tippy.js/dist/tippy.css";
import { sanitizeHtml } from "../lib/html";
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

function TooltipContent({ item }: { item: Item }) {
  const price = formatPrice(item.price);
  const description = item.description ? sanitizeHtml(item.description) : null;
  const headerBg =
    RARITY_HEADER_COLORS[item.rarity] ?? RARITY_HEADER_COLORS.common;

  return (
    <div className="item-tooltip">
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
            <div
              className="item-tooltip-desc"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized by sanitizeHtml
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function ItemTooltipWrapper({
  item,
  children,
}: {
  item: Item;
  children: ReactElement;
}) {
  return (
    <Tippy
      delay={[300, 0]}
      placement="bottom-start"
      interactive
      appendTo={() => document.body}
      maxWidth={420}
      content={<TooltipContent item={item} />}
      popperOptions={{
        modifiers: [
          { name: "flip", options: { fallbackPlacements: ["top-start"] } },
          { name: "preventOverflow", options: { padding: 8 } },
        ],
      }}
    >
      {children}
    </Tippy>
  );
}
