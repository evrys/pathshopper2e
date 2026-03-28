import { useEffect, useState } from "react";
import type { Item } from "../types";

let cachedItems: Item[] | null = null;

export function useItems() {
  const [items, setItems] = useState<Item[]>(cachedItems ?? []);
  const [loading, setLoading] = useState(cachedItems === null);

  useEffect(() => {
    if (cachedItems) return;

    fetch("/data/items.json")
      .then((res) => res.json())
      .then((data: Item[]) => {
        cachedItems = data;
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load items:", err);
        setLoading(false);
      });
  }, []);

  return { items, loading };
}

/** Get unique values for a given field across all items */
export function useItemFieldValues(
  items: Item[],
  field: "type" | "rarity" | "category" | "source",
): string[] {
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    const unique = [...new Set(items.map((i) => i[field]).filter(Boolean))];
    unique.sort();
    setValues(unique);
  }, [items, field]);

  return values;
}
