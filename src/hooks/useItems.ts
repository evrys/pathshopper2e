import { useEffect, useState } from "react";
import { stripHtml } from "../lib/html";
import { loadTraitUrls } from "../lib/traits";
import type { Item } from "../types";

let cachedItems: Item[] | null = null;

export function useItems() {
  const [items, setItems] = useState<Item[]>(cachedItems ?? []);
  const [loading, setLoading] = useState(cachedItems === null);

  useEffect(() => {
    if (cachedItems) return;

    Promise.all([
      fetch("/data/items.json")
        .then((res) => res.json())
        .then((data: Item[]) => {
          for (const item of data) {
            (item as Item).plainDescription = stripHtml(item.description);
          }
          return data;
        }),
      loadTraitUrls(),
    ])
      .then(([data]) => {
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
