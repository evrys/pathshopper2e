import { useEffect, useRef, useState } from "react";
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
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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
    <div className={styles.multiselect} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.label}>{label}</span>
        <span className={styles.arrow}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className={styles.menu}>
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
      )}
    </div>
  );
}
