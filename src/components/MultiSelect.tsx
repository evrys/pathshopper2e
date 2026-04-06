import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import styles from "./MultiSelect.module.css";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectGroup {
  label: string;
  options: MultiSelectOption[];
}

interface MultiSelectProps {
  options?: MultiSelectOption[];
  groups?: MultiSelectGroup[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  placeholder?: string;
}

export function MultiSelect({
  options,
  groups,
  selected,
  onChange,
  placeholder = "All",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const allOptions = groups
    ? groups.flatMap((g) => g.options)
    : (options ?? []);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  const selectedLabels = allOptions
    .filter((o) => selected.has(o.value))
    .map((o) => o.label);

  const label =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, 2).join(", ")} (+${selectedLabels.length - 2} more)`;

  function renderOption(opt: MultiSelectOption) {
    return (
      <li key={opt.value}>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={selected.has(opt.value)}
            onChange={() => toggle(opt.value)}
          />
          {opt.label}
        </label>
      </li>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={styles.trigger}>
          <span className={styles.label}>{label}</span>
          <span className={styles.arrow}>{open ? "▲" : "▼"}</span>
        </button>
      </Popover.Trigger>
      <Popover.Content
        className={styles.menu}
        sideOffset={4}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ul className={styles.menuList}>
          {groups
            ? groups.map((group) => (
                <li key={group.label}>
                  <span className={styles.groupHeader}>{group.label}</span>
                  <ul className={styles.menuList}>
                    {group.options.map(renderOption)}
                  </ul>
                </li>
              ))
            : allOptions.map(renderOption)}
        </ul>
      </Popover.Content>
    </Popover.Root>
  );
}
