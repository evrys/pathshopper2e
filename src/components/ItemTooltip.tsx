import Tippy from "@tippyjs/react";
import type { ReactElement } from "react";
import "tippy.js/dist/tippy.css";
import { sanitizeHtml } from "../lib/html";
import { formatPrice } from "../lib/price";
import type { Item } from "../types";
import styles from "./ItemTooltip.module.css";

// Worn slots that are concatenated without a separator in the raw data.
const WORN_SLOTS = new Set([
  "amulet",
  "anklets",
  "armbands",
  "backpack",
  "belt",
  "boots",
  "bracelet",
  "bracers",
  "cap",
  "cape",
  "circlet",
  "cloak",
  "clothing",
  "collar",
  "crown",
  "epaulet",
  "eyeglasses",
  "eyepiece",
  "footwear",
  "garment",
  "gloves",
  "headwear",
  "horseshoes",
  "mask",
  "necklace",
  "ring",
  "saddle",
  "sandles",
  "shoes",
]);

/** Format a kebab-case usage string into a human-readable label. */
function formatUsage(usage: string): string {
  // Handle "worn<slot>" concatenated values (e.g. "wornbracers" → "worn bracers")
  if (usage.startsWith("worn")) {
    const slot = usage.slice("worn".length);
    if (WORN_SLOTS.has(slot)) {
      usage = `worn ${slot}`;
    }
  }

  return usage.replace(/-/g, " ").replace(/\bwo\b/g, "w/o");
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
    <div className={styles.tooltip}>
      <div className={styles.header} style={{ background: headerBg }}>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.level}>Item {item.level}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
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
          <div className={styles.traits}>
            {item.traits.map((t) => (
              <span key={t} className={styles.trait}>
                {formatTrait(t)}
              </span>
            ))}
          </div>
        )}
        {description && (
          <>
            <hr className={styles.divider} />
            <div
              className={styles.desc}
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
