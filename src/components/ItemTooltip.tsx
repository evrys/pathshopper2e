import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import { sanitizeHtml } from "../lib/html";
import { formatPrice } from "../lib/price";
import { formatTrait, traitUrl } from "../lib/traits";
import type { Item } from "../types";
import styles from "./ItemTooltip.module.css";

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
              <strong>Usage</strong> {item.usage}
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
            {item.traits.map((t) => {
              const label = formatTrait(t);
              const href = traitUrl(t);
              return href ? (
                <a
                  key={t}
                  className={styles.trait}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {label}
                </a>
              ) : (
                <span key={t} className={styles.trait}>
                  {label}
                </span>
              );
            })}
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
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;

    // Create a detached container for React to render the tooltip content into
    const container = document.createElement("div");
    const root = createRoot(container);
    root.render(<TooltipContent item={item} />);

    const instance = tippy(el, {
      content: container,
      delay: [300, 100],
      maxWidth: 480,
      placement: "right",
      allowHTML: true,
      interactive: true,
      appendTo: () => document.body,
    });

    return () => {
      instance.destroy();
      // Defer unmount to avoid "synchronously unmount while rendering" warning
      queueMicrotask(() => root.unmount());
    };
  }, [item]);

  return <span ref={anchorRef}>{children}</span>;
}
