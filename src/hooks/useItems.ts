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
