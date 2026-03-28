import { useEffect, useState } from "react";
import { stripHtml } from "../lib/html";
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
        // Pre-strip HTML descriptions once so search never has to redo it.
        for (const item of data) {
          (item as Item).plainDescription = stripHtml(item.description);
        }
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
