import { useEffect, useState } from "react";
import { stripHtml } from "../lib/html";
import { loadTraitUrls } from "../lib/traits";
import type { Item, JsonItem } from "../types";

let cachedItems: Item[] | null = null;

export function useItems() {
  const [items, setItems] = useState<Item[]>(cachedItems ?? []);
  const [loading, setLoading] = useState(cachedItems === null);

  useEffect(() => {
    if (cachedItems) return;

    Promise.all([
      fetch("/data/items.json")
        .then((res) => res.json())
        .then((data: JsonItem[]) => {
          const enriched = data.map((item) => ({
            ...item,
            plainDescription: stripHtml(item.description),
          }));
          return enriched;
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
