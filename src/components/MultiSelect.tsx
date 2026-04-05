import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import styles from "./MultiSelect.module.css";

interface MultiSelectProps {
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  placeholder?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "All",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  const label =
    selected.size === 0
      ? placeholder
      : options
          .filter((o) => selected.has(o.value))
          .map((o) => o.label)
          .join(", ");

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
          {options.map((opt) => (
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
          ))}
        </ul>
      </Popover.Content>
    </Popover.Root>
  );
}
