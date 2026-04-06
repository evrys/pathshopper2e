import * as Dialog from "@radix-ui/react-dialog";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { useMemo, useState } from "react";
import {
  DEFAULT_RARITIES,
  DEFAULT_REMASTER,
  TYPE_LABELS,
} from "../lib/constants";
import { formatTrait } from "../lib/traits";
import type { Item } from "../types";
import styles from "./FilterModal.module.css";
import { MultiSelect } from "./MultiSelect";

const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

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
  items: Item[];
  typeFilter: Set<string>;
  rarityFilter: Set<string>;
  remasterFilter: Set<string>;
  traitFilter: Set<string>;
  sourceFilter: Set<string>;
  minLevel: string;
  maxLevel: string;
  onFiltersChange: (filters: {
    typeFilter?: Set<string>;
    rarityFilter?: Set<string>;
    remasterFilter?: Set<string>;
    traitFilter?: Set<string>;
    sourceFilter?: Set<string>;
    minLevel?: string;
    maxLevel?: string;
  }) => void;
}

export function FilterModal({
  items,
  typeFilter,
  rarityFilter,
  remasterFilter,
  traitFilter,
  sourceFilter,
  minLevel,
  maxLevel,
  onFiltersChange,
}: FilterModalProps) {
  const [open, setOpen] = useState(false);

  const traitOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const t of item.traits) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value]) => ({ value, label: formatTrait(value) }));
  }, [items]);

  const sourceOptions = useMemo(() => {
    const sources = new Map<string, string>();
    for (const item of items) {
      if (item.sourceId && !sources.has(item.sourceId)) {
        sources.set(item.sourceId, item.source);
      }
    }
    return [...sources.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: id, label: name }));
  }, [items]);

  const activeCount =
    (typeFilter.size > 0 ? 1 : 0) +
    (rarityFilter.size > 0 ? 1 : 0) +
    (remasterFilter.size > 0 ? 1 : 0) +
    (traitFilter.size > 0 ? 1 : 0) +
    (sourceFilter.size > 0 ? 1 : 0) +
    (minLevel ? 1 : 0) +
    (maxLevel ? 1 : 0);

  function handleClear() {
    onFiltersChange({
      typeFilter: new Set<string>(),
      rarityFilter: new Set<string>(),
      remasterFilter: new Set<string>(),
      traitFilter: new Set<string>(),
      sourceFilter: new Set<string>(),
      minLevel: "",
      maxLevel: "",
    });
  }

  function handleReset() {
    onFiltersChange({
      typeFilter: new Set<string>(),
      rarityFilter: new Set(DEFAULT_RARITIES),
      remasterFilter: new Set(DEFAULT_REMASTER),
      traitFilter: new Set<string>(),
      sourceFilter: new Set<string>(),
      minLevel: "",
      maxLevel: "",
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={styles.filterBtn}>
          <MixerHorizontalIcon className={styles.filterIcon} />
          Filters
          {activeCount > 0 && (
            <span className={styles.badge}>{activeCount}</span>
          )}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          <div className={styles.panelHeader}>
            <Dialog.Title asChild>
              <h2>Filters</h2>
            </Dialog.Title>
            <Dialog.Close
              className={styles.closeBtn}
              aria-label="Close filters"
            >
              ✕
            </Dialog.Close>
          </div>

          <div className={styles.panelBody}>
            <div className={styles.filterGroup}>
              <span className={styles.groupLabel}>Item Type</span>
              <MultiSelect
                placeholder="All Types"
                options={TYPE_OPTIONS}
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
              <span className={styles.groupLabel}>Traits</span>
              <MultiSelect
                placeholder="All Traits"
                options={traitOptions}
                selected={traitFilter}
                onChange={(next) => onFiltersChange({ traitFilter: next })}
              />
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.groupLabel}>Source</span>
              <MultiSelect
                placeholder="All Sources"
                options={sourceOptions}
                selected={sourceFilter}
                onChange={(next) => onFiltersChange({ sourceFilter: next })}
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
            <Dialog.Close asChild>
              <button type="button" className={styles.doneBtn}>
                Done
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
