import { useCallback, useEffect, useRef, useState } from "react";

const LIST_PREFIX = "pathshopper2e:list:";
const ACTIVE_KEY = "pathshopper2e:active-list-id";
const DEFAULT_LIST_NAME = "Shopping List";

export interface SavedList {
  /** Unique identifier for this list. */
  id: string;
  /** Display name of the list. */
  name: string;
  /** Map of item id → quantity. */
  items: Record<string, number>;
  /** ISO timestamp of last save. */
  savedAt: string;
}

export interface SavedListsState {
  lists: SavedList[];
  activeListId: string;
}

/** Generate a unique list id. */
export function generateListId(): string {
  return crypto.randomUUID();
}

function createDefaultList(): SavedList {
  return {
    id: generateListId(),
    name: DEFAULT_LIST_NAME,
    items: {},
    savedAt: new Date().toISOString(),
  };
}

/** Read a single list from its localStorage key. */
function readList(id: string): SavedList | null {
  try {
    const raw = localStorage.getItem(`${LIST_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as SavedList;
  } catch {
    return null;
  }
}

/** Discover all saved lists by scanning localStorage keys. */
function readAllLists(): SavedList[] {
  const lists: SavedList[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LIST_PREFIX)) continue;
    const list = readList(key.slice(LIST_PREFIX.length));
    if (list) lists.push(list);
  }
  // Sort newest first
  lists.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return lists;
}

export function readFromStorage(): SavedListsState {
  try {
    const lists = readAllLists();
    const activeId = localStorage.getItem(ACTIVE_KEY) ?? "";
    if (lists.length === 0) {
      const defaultList = createDefaultList();
      writeList(defaultList);
      writeActiveId(defaultList.id);
      return { lists: [defaultList], activeListId: defaultList.id };
    }
    const resolved = lists.find((l) => l.id === activeId)?.id ?? lists[0].id;
    return { lists, activeListId: resolved };
  } catch {
    const defaultList = createDefaultList();
    return { lists: [defaultList], activeListId: defaultList.id };
  }
}

function writeList(list: SavedList): void {
  try {
    localStorage.setItem(`${LIST_PREFIX}${list.id}`, JSON.stringify(list));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function removeList(id: string): void {
  try {
    localStorage.removeItem(`${LIST_PREFIX}${id}`);
  } catch {
    // silently ignore
  }
}

function writeActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // silently ignore
  }
}

export function useSavedLists() {
  const [state, setState] = useState<SavedListsState>(readFromStorage);

  // Refresh list data when other tabs write to localStorage,
  // but preserve this tab's own active list selection.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key?.startsWith(LIST_PREFIX)) {
        setState((prev) => {
          const lists = readAllLists();
          // If the active list was deleted in another tab, fall back
          const stillExists = lists.some((l) => l.id === prev.activeListId);
          return {
            lists,
            activeListId: stillExists
              ? prev.activeListId
              : (lists[0]?.id ?? prev.activeListId),
          };
        });
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const activeList = state.lists.find((l) => l.id === state.activeListId);

  /** Save items to the currently active list (auto-save). */
  const saveActiveList = useCallback((items: Map<string, number>) => {
    setState((prev) => {
      const next = prev.lists.map((l) => {
        if (l.id !== prev.activeListId) return l;
        const updated = {
          ...l,
          items: Object.fromEntries(items),
          savedAt: new Date().toISOString(),
        };
        writeList(updated);
        return updated;
      });
      return { ...prev, lists: next };
    });
  }, []);

  /** Rename the currently active list. */
  const renameActiveList = useCallback((name: string) => {
    setState((prev) => {
      const next = prev.lists.map((l) => {
        if (l.id !== prev.activeListId) return l;
        const updated = { ...l, name };
        writeList(updated);
        return updated;
      });
      return { ...prev, lists: next };
    });
  }, []);

  /** Switch to a different list by id. */
  const switchToList = useCallback((id: string) => {
    setState((prev) => {
      writeActiveId(id);
      return { ...prev, activeListId: id };
    });
  }, []);

  /** Create a new empty list and switch to it. Returns the new list. */
  const createList = useCallback((name: string): SavedList => {
    const newList: SavedList = {
      id: generateListId(),
      name: name.trim() || DEFAULT_LIST_NAME,
      items: {},
      savedAt: new Date().toISOString(),
    };
    writeList(newList);
    writeActiveId(newList.id);
    setState((prev) => ({
      lists: [newList, ...prev.lists],
      activeListId: newList.id,
    }));
    return newList;
  }, []);

  /** Delete a list by id. If it's the active list, switch to the first remaining. */
  const deleteList = useCallback((id: string) => {
    removeList(id);
    setState((prev) => {
      const next = prev.lists.filter((l) => l.id !== id);
      let activeId = prev.activeListId;
      if (activeId === id) {
        if (next.length === 0) {
          const defaultList = createDefaultList();
          writeList(defaultList);
          next.push(defaultList);
          activeId = defaultList.id;
        } else {
          activeId = next[0].id;
        }
      }
      writeActiveId(activeId);
      return { lists: next, activeListId: activeId };
    });
  }, []);

  // Track previous active list id to detect switches
  const prevActiveIdRef = useRef(state.activeListId);
  const activeListChanged = prevActiveIdRef.current !== state.activeListId;

  useEffect(() => {
    prevActiveIdRef.current = state.activeListId;
  }, [state.activeListId]);

  return {
    lists: state.lists,
    activeList,
    activeListId: state.activeListId,
    activeListChanged,
    saveActiveList,
    renameActiveList,
    switchToList,
    createList,
    deleteList,
  };
}
