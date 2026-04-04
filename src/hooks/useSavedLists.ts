import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "pathshopper2e:saved-lists";
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

let idCounter = 0;

/** Generate a unique list id. */
export function generateListId(): string {
  return `${Date.now()}-${++idCounter}`;
}

function createDefaultList(): SavedList {
  return {
    id: generateListId(),
    name: DEFAULT_LIST_NAME,
    items: {},
    savedAt: new Date().toISOString(),
  };
}

export function readFromStorage(): SavedListsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const activeId = localStorage.getItem(ACTIVE_KEY) ?? "";
    if (!raw) {
      const defaultList = createDefaultList();
      return { lists: [defaultList], activeListId: defaultList.id };
    }
    const lists = JSON.parse(raw) as SavedList[];
    if (lists.length === 0) {
      const defaultList = createDefaultList();
      return { lists: [defaultList], activeListId: defaultList.id };
    }
    // If the saved active id doesn't match any list, default to the first
    const resolved = lists.find((l) => l.id === activeId)?.id ?? lists[0].id;
    return { lists, activeListId: resolved };
  } catch {
    const defaultList = createDefaultList();
    return { lists: [defaultList], activeListId: defaultList.id };
  }
}

function writeLists(lists: SavedList[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // Storage full or unavailable — silently ignore
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

  // Keep in sync across tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY || e.key === ACTIVE_KEY) {
        setState(readFromStorage());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const activeList = state.lists.find((l) => l.id === state.activeListId);

  /** Save items to the currently active list (auto-save). */
  const saveActiveList = useCallback((items: Map<string, number>) => {
    setState((prev) => {
      const next = prev.lists.map((l) =>
        l.id === prev.activeListId
          ? {
              ...l,
              items: Object.fromEntries(items),
              savedAt: new Date().toISOString(),
            }
          : l,
      );
      writeLists(next);
      return { ...prev, lists: next };
    });
  }, []);

  /** Rename the currently active list. */
  const renameActiveList = useCallback((name: string) => {
    setState((prev) => {
      const next = prev.lists.map((l) =>
        l.id === prev.activeListId ? { ...l, name } : l,
      );
      writeLists(next);
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
    setState((prev) => {
      const next = [newList, ...prev.lists];
      writeLists(next);
      writeActiveId(newList.id);
      return { lists: next, activeListId: newList.id };
    });
    return newList;
  }, []);

  /** Delete a list by id. If it's the active list, switch to the first remaining. */
  const deleteList = useCallback((id: string) => {
    setState((prev) => {
      const next = prev.lists.filter((l) => l.id !== id);
      // If we deleted the active list, switch to another
      let activeId = prev.activeListId;
      if (activeId === id) {
        if (next.length === 0) {
          // Always keep at least one list
          const defaultList = createDefaultList();
          next.push(defaultList);
          activeId = defaultList.id;
        } else {
          activeId = next[0].id;
        }
      }
      writeLists(next);
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
