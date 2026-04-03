import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pathshopper2e:saved-lists";

export interface SavedList {
  /** Display name of the list. */
  name: string;
  /** Map of item id → quantity. */
  items: Record<string, number>;
  /** ISO timestamp of last save. */
  savedAt: string;
}

function readFromStorage(): SavedList[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedList[];
  } catch {
    return [];
  }
}

function writeToStorage(lists: SavedList[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function useSavedLists() {
  const [lists, setLists] = useState<SavedList[]>(readFromStorage);

  // Keep in sync across tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setLists(readFromStorage());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const saveList = useCallback((name: string, items: Map<string, number>) => {
    if (!name.trim()) return;
    const entry: SavedList = {
      name: name.trim(),
      items: Object.fromEntries(items),
      savedAt: new Date().toISOString(),
    };
    setLists((prev) => {
      // Replace existing entry with the same name, otherwise prepend
      const filtered = prev.filter((l) => l.name !== entry.name);
      const next = [entry, ...filtered];
      writeToStorage(next);
      return next;
    });
  }, []);

  const deleteList = useCallback((name: string) => {
    setLists((prev) => {
      const next = prev.filter((l) => l.name !== name);
      writeToStorage(next);
      return next;
    });
  }, []);

  return { lists, saveList, deleteList };
}
