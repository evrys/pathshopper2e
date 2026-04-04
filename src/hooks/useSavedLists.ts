import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

const LIST_PREFIX = "pathshopper2e:list:";
const ACTIVE_KEY = "pathshopper2e:active-list-id";
const DEFAULT_LIST_NAME = "My shopping list";

/** Query key used by TanStack Query for the saved lists. */
export const LISTS_QUERY_KEY = ["saved-lists"] as const;

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

/**
 * Save a list to localStorage and mark it as the active list.
 * This is a standalone helper for use outside the hook (e.g. from
 * the shared-list view) so the editor will pick it up on load.
 */
export function saveListToStorage(list: SavedList): void {
  writeList(list);
  writeActiveId(list.id);
}

export function useSavedLists() {
  const queryClient = useQueryClient();

  // Seed initial data synchronously so the first render has lists immediately.
  const [initialState] = useState(readFromStorage);

  // Read all lists from localStorage via TanStack Query.
  // Automatically re-fetches on window focus, giving cross-tab sync.
  const { data: lists = [] } = useQuery({
    queryKey: LISTS_QUERY_KEY,
    queryFn: () => {
      const all = readAllLists();
      if (all.length > 0) return all;
      // Bootstrap a default list when storage is empty
      const defaultList = createDefaultList();
      writeList(defaultList);
      return [defaultList];
    },
    initialData: initialState.lists,
    // localStorage reads are sync, so treat them as always fresh
    // but still refetch on window focus
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: "always",
  });

  // Active list id is per-tab state (not synced across tabs).
  const [activeListId, setActiveListId] = useState(
    () => initialState.activeListId,
  );

  // If the active list no longer exists (e.g. deleted in another tab),
  // fall back to the first available list.
  const resolvedActiveId =
    lists.find((l) => l.id === activeListId)?.id ??
    lists[0]?.id ??
    activeListId;
  if (resolvedActiveId !== activeListId) {
    // Sync state without an extra render cycle
    setActiveListId(resolvedActiveId);
  }

  const activeList = lists.find((l) => l.id === resolvedActiveId);

  /** Immediately re-read lists from localStorage into the query cache. */
  const refreshLists = useCallback(() => {
    queryClient.setQueryData(LISTS_QUERY_KEY, readAllLists());
  }, [queryClient]);

  // Track which savedAt values came from this tab's own saves,
  // so we don't reload the cart after our own auto-save writes.
  const ownSavedAtRef = useRef<Set<string>>(new Set());

  /** Save items to the currently active list (auto-save). */
  const saveActiveList = useCallback(
    (items: Map<string, number>) => {
      const list = lists.find((l) => l.id === resolvedActiveId);
      if (!list) return;
      const savedAt = new Date().toISOString();
      const updated = {
        ...list,
        items: Object.fromEntries(items),
        savedAt,
      };
      writeList(updated);
      ownSavedAtRef.current.add(savedAt);
      refreshLists();
    },
    [lists, resolvedActiveId, refreshLists],
  );

  /** Rename the currently active list. */
  const renameActiveList = useCallback(
    (name: string) => {
      const list = lists.find((l) => l.id === resolvedActiveId);
      if (!list) return;
      const savedAt = new Date().toISOString();
      const updated = { ...list, name, savedAt };
      writeList(updated);
      ownSavedAtRef.current.add(savedAt);
      refreshLists();
    },
    [lists, resolvedActiveId, refreshLists],
  );

  /** Switch to a different list by id. */
  const switchToList = useCallback((id: string) => {
    writeActiveId(id);
    setActiveListId(id);
  }, []);

  /** Create a new empty list and switch to it. Returns the new list. */
  const createList = useCallback(
    (name: string): SavedList => {
      const newList: SavedList = {
        id: generateListId(),
        name: name.trim() || DEFAULT_LIST_NAME,
        items: {},
        savedAt: new Date().toISOString(),
      };
      writeList(newList);
      writeActiveId(newList.id);
      setActiveListId(newList.id);
      refreshLists();
      return newList;
    },
    [refreshLists],
  );

  /** Delete a list by id. If it's the active list, switch to the first remaining. */
  const deleteList = useCallback(
    (id: string) => {
      removeList(id);
      if (resolvedActiveId === id) {
        const remaining = lists.filter((l) => l.id !== id);
        if (remaining.length === 0) {
          const defaultList = createDefaultList();
          writeList(defaultList);
          writeActiveId(defaultList.id);
          setActiveListId(defaultList.id);
        } else {
          writeActiveId(remaining[0].id);
          setActiveListId(remaining[0].id);
        }
      }
      refreshLists();
    },
    [lists, resolvedActiveId, refreshLists],
  );

  // Detect when the cart should be reloaded from the saved list.
  // This fires on list switches AND when another tab updates the same list
  // (detected via savedAt changing on refetch).
  const prevActiveRef = useRef({
    id: resolvedActiveId,
    savedAt: activeList?.savedAt ?? "",
  });

  const prev = prevActiveRef.current;
  const idSwitched = prev.id !== resolvedActiveId;
  const savedAtChanged = prev.savedAt !== (activeList?.savedAt ?? "");
  const externalContentChange =
    !idSwitched &&
    savedAtChanged &&
    !ownSavedAtRef.current.has(activeList?.savedAt ?? "");

  const activeListChanged = idSwitched || externalContentChange;

  useEffect(() => {
    prevActiveRef.current = {
      id: resolvedActiveId,
      savedAt: activeList?.savedAt ?? "",
    };
    // Prevent the ownSavedAt set from growing unboundedly — once a
    // snapshot is consumed we no longer need older timestamps.
    ownSavedAtRef.current.clear();
  }, [resolvedActiveId, activeList?.savedAt]);

  return {
    lists,
    activeList,
    activeListId: resolvedActiveId,
    activeListChanged: activeListChanged,
    saveActiveList,
    renameActiveList,
    switchToList,
    createList,
    deleteList,
  };
}
