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

    async function load() {
      try {
        const [res] = await Promise.all([
          fetch("./data/items.json"),
          loadTraitUrls(),
        ]);
        const data = (await res.json()) as JsonItem[];
        const enriched = data.map((item) => ({
          ...item,
          plainDescription: stripHtml(item.description),
        }));
        cachedItems = enriched;
        setItems(enriched);
      } catch (err) {
        console.error("Failed to load items:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { items, loading };
}
