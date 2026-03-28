import type { Item } from "../types";

const AON_BASE = "https://2e.aonprd.com";

/** Get the Archives of Nethys URL for an item, falling back to search */
export function aonUrl(item: Item): string {
  if (item.aonUrl) {
    return `${AON_BASE}${item.aonUrl}`;
  }
  return `${AON_BASE}/Search.aspx?q=${encodeURIComponent(item.name)}`;
}
