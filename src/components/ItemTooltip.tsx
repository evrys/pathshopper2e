import * as Tooltip from "@radix-ui/react-tooltip";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../hooks/useMediaQuery";
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

function MobileTooltip({ item, onClose }: { item: Item; onClose: () => void }) {
  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: tap-to-dismiss overlay
    <div className={styles.mobileOverlay} role="dialog" onClick={onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation wrapper */}
      <div
        className={styles.mobileContent}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <TooltipContent item={item} />
      </div>
    </div>,
    document.body,
  );
}

export function ItemTooltipWrapper({
  item,
  children,
}: {
  item: Item;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const touchedRef = useRef(false);
  const isMobile = useMediaQuery("(max-width: 640px)");

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Only intercept touch-originated clicks when the tooltip isn't open yet
      if (touchedRef.current && !open) {
        e.preventDefault();
        setOpen(true);
      }
      touchedRef.current = false;
    },
    [open],
  );

  if (isMobile) {
    return (
      <>
        <span
          onTouchStart={() => {
            touchedRef.current = true;
          }}
          onClickCapture={handleClick}
        >
          {children}
        </span>
        {open && <MobileTooltip item={item} onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>
        <span
          onTouchStart={() => {
            touchedRef.current = true;
          }}
          onClickCapture={handleClick}
        >
          {children}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className={styles.content}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <TooltipContent item={item} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
