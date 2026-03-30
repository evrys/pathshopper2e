import { useEffect, useRef, useState } from "react";
import styles from "./FilterModal.module.css";
import { MultiSelect } from "./MultiSelect";

const DEFAULT_RARITIES = new Set(["common", "uncommon"]);
const DEFAULT_REMASTER = new Set(["remastered"]);

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

const RARITY_OPTIONS = [
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "unique", label: "Unique" },
];

const REMASTER_OPTIONS = [
  { value: "remastered", label: "Remastered" },
  { value: "legacy", label: "Legacy" },
];

interface FilterModalProps {
  typeFilter: Set<string>;
  rarityFilter: Set<string>;
  remasterFilter: Set<string>;
  minLevel: string;
  maxLevel: string;
  onFiltersChange: (filters: {
    typeFilter?: Set<string>;
    rarityFilter?: Set<string>;
    remasterFilter?: Set<string>;
    minLevel?: string;
    maxLevel?: string;
  }) => void;
}

export function FilterModal({
  typeFilter,
  rarityFilter,
  remasterFilter,
  minLevel,
  maxLevel,
  onFiltersChange,
}: FilterModalProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeCount =
    (typeFilter.size > 0 ? 1 : 0) +
    (rarityFilter.size > 0 ? 1 : 0) +
    (remasterFilter.size > 0 ? 1 : 0) +
    (minLevel ? 1 : 0) +
    (maxLevel ? 1 : 0);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleClear() {
    onFiltersChange({
      typeFilter: new Set<string>(),
      rarityFilter: new Set<string>(),
      remasterFilter: new Set<string>(),
      minLevel: "",
      maxLevel: "",
    });
  }

  function handleReset() {
    onFiltersChange({
      typeFilter: new Set<string>(),
      rarityFilter: new Set(DEFAULT_RARITIES),
      remasterFilter: new Set(DEFAULT_REMASTER),
      minLevel: "",
      maxLevel: "",
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.filterBtn}
        onClick={() => setOpen(true)}
      >
        <span className={styles.filterIcon}>⚙</span>
        Filters
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </button>

      {open && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className={styles.panel} ref={panelRef}>
            <div className={styles.panelHeader}>
              <h2>Filters</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="Close filters"
              >
                ✕
              </button>
            </div>

            <div className={styles.panelBody}>
              <div className={styles.filterGroup}>
                <span className={styles.groupLabel}>Item Type</span>
                <MultiSelect
                  placeholder="All Types"
                  options={Object.entries(TYPE_LABELS).map(
                    ([value, label]) => ({
                      value,
                      label,
                    }),
                  )}
                  selected={typeFilter}
                  onChange={(next) => onFiltersChange({ typeFilter: next })}
                />
              </div>

              <div className={styles.filterGroup}>
                <span className={styles.groupLabel}>Rarity</span>
                <MultiSelect
                  placeholder="All Rarities"
                  options={RARITY_OPTIONS}
                  selected={rarityFilter}
                  onChange={(next) => onFiltersChange({ rarityFilter: next })}
                />
              </div>

              <div className={styles.filterGroup}>
                <span className={styles.groupLabel}>Content</span>
                <MultiSelect
                  placeholder="All Content"
                  options={REMASTER_OPTIONS}
                  selected={remasterFilter}
                  onChange={(next) => onFiltersChange({ remasterFilter: next })}
                />
              </div>

              <div className={styles.filterGroup}>
                <span className={styles.groupLabel}>Level Range</span>
                <div className={styles.levelRow}>
                  <input
                    type="number"
                    placeholder="Min"
                    aria-label="Minimum level"
                    value={minLevel}
                    onChange={(e) =>
                      onFiltersChange({ minLevel: e.target.value })
                    }
                    min={0}
                    max={30}
                  />
                  <span className={styles.levelSeparator}>–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    aria-label="Maximum level"
                    value={maxLevel}
                    onChange={(e) =>
                      onFiltersChange({ maxLevel: e.target.value })
                    }
                    min={0}
                    max={30}
                  />
                </div>
              </div>
            </div>

            <div className={styles.panelFooter}>
              {activeCount > 0 && (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={handleClear}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className={styles.clearBtn}
                onClick={handleReset}
              >
                Reset
              </button>
              <button
                type="button"
                className={styles.doneBtn}
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
