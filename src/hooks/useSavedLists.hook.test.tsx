// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PriceModifier } from "../types";
import {
  type SavedCustomItem,
  type SavedList,
  type SavedListData,
  saveListToStorage,
  useSavedLists,
} from "./useSavedLists";

const LIST_PREFIX = "pathshopper2e:list:";
const ACTIVE_KEY = "pathshopper2e:active-list-id";

/** Build a SavedListData from Maps, matching the old saveActiveList arg style. */
function makeSavedData(
  items: Map<string, number>,
  priceModifiers?: Map<string, PriceModifier>,
  customItems?: SavedCustomItem[],
  notes?: Map<string, string>,
): SavedListData {
  return {
    items: Object.fromEntries(items),
    priceModifiers:
      priceModifiers && priceModifiers.size > 0
        ? Object.fromEntries(priceModifiers)
        : undefined,
    notes: notes && notes.size > 0 ? Object.fromEntries(notes) : undefined,
    customItems:
      customItems && customItems.length > 0 ? customItems : undefined,
  };
}

function storeList(list: SavedList): void {
  localStorage.setItem(`${LIST_PREFIX}${list.id}`, JSON.stringify(list));
}

function getStoredList(id: string): SavedList | null {
  const raw = localStorage.getItem(`${LIST_PREFIX}${id}`);
  return raw ? (JSON.parse(raw) as SavedList) : null;
}

function getStoredActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function makeList(overrides: Partial<SavedList> = {}): SavedList {
  return {
    id: "list-1",
    name: "Test List",
    items: {},
    savedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe("useSavedLists hook", () => {
  describe("initialization", () => {
    it("creates a default list when storage is empty", async () => {
      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      expect(result.current.lists[0].name).toBe("Wishlist");
      expect(result.current.activeList).toBeDefined();
      expect(result.current.activeListId).toBe(result.current.lists[0].id);
    });

    it("persists the default list to localStorage", async () => {
      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      const stored = getStoredList(result.current.lists[0].id);
      expect(stored).not.toBeNull();
      expect(stored?.name).toBe("Wishlist");
    });

    it("loads existing lists from localStorage", async () => {
      const list = makeList();
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      expect(result.current.lists[0].name).toBe("Test List");
      expect(result.current.activeListId).toBe("list-1");
      expect(result.current.activeList?.id).toBe("list-1");
    });

    it("loads multiple lists sorted by savedAt descending", async () => {
      storeList(
        makeList({
          id: "old",
          name: "Old",
          savedAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      storeList(
        makeList({
          id: "new",
          name: "New",
          savedAt: "2025-06-01T00:00:00.000Z",
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "old");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      expect(result.current.lists[0].name).toBe("New");
      expect(result.current.lists[1].name).toBe("Old");
      expect(result.current.activeListId).toBe("old");
    });

    it("falls back to first list if active id is invalid", async () => {
      storeList(
        makeList({ id: "list-1", savedAt: "2025-06-01T00:00:00.000Z" }),
      );
      localStorage.setItem(ACTIVE_KEY, "nonexistent");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      expect(result.current.activeListId).toBe("list-1");
    });

    it("does not set activeListChanged on first render", async () => {
      storeList(makeList({ id: "list-1" }));
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList).toBeDefined();
      });

      expect(result.current.activeListChanged).toBe(false);
    });
  });

  describe("createList", () => {
    it("creates a new list and switches to it", async () => {
      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      let createdId = "";
      act(() => {
        const newList = result.current.createList("Weapons");
        createdId = newList.id;
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      expect(result.current.activeListId).toBe(createdId);
      expect(result.current.activeList?.name).toBe("Weapons");
      // Persisted to localStorage
      expect(getStoredList(createdId)?.name).toBe("Weapons");
      expect(getStoredActiveId()).toBe(createdId);
    });

    it("uses default name when given empty string", async () => {
      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      act(() => {
        result.current.createList("  ");
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      expect(result.current.activeList?.name).toBe("Wishlist");
    });

    it("trims whitespace from name", async () => {
      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      act(() => {
        result.current.createList("  Armor  ");
      });

      await waitFor(() => {
        expect(result.current.activeList?.name).toBe("Armor");
      });
    });

    it("returns the created list object", async () => {
      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      let created: SavedList | undefined;
      act(() => {
        created = result.current.createList("New");
      });

      expect(created).toBeDefined();
      expect(created?.name).toBe("New");
      expect(created?.items).toEqual({});
      expect(created?.id).toBeTruthy();
    });
  });

  describe("saveActiveList", () => {
    it("saves items to the active list", async () => {
      const list = makeList();
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList).toBeDefined();
      });

      act(() => {
        result.current.saveActiveList(
          makeSavedData(
            new Map([
              ["sword-1", 2],
              ["potion-1", 5],
            ]),
          ),
        );
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({
          "sword-1": 2,
          "potion-1": 5,
        });
      });

      // Verify localStorage was updated
      const stored = getStoredList("list-1");
      expect(stored?.items).toEqual({ "sword-1": 2, "potion-1": 5 });
    });

    it("updates savedAt timestamp on save", async () => {
      const list = makeList({ savedAt: "2020-01-01T00:00:00.000Z" });
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList).toBeDefined();
      });

      act(() => {
        result.current.saveActiveList(makeSavedData(new Map([["item-1", 1]])));
      });

      await waitFor(() => {
        const savedAt = result.current.activeList?.savedAt ?? "";
        expect(savedAt > "2020-01-01T00:00:00.000Z").toBe(true);
      });
    });

    it("does not trigger activeListChanged for own saves", async () => {
      const list = makeList();
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeListChanged).toBe(false);
      });

      act(() => {
        result.current.saveActiveList(makeSavedData(new Map([["sword-1", 1]])));
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({ "sword-1": 1 });
      });
      expect(result.current.activeListChanged).toBe(false);
    });

    it("replaces previous items entirely", async () => {
      const list = makeList({ items: { "old-item": 3 } });
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({ "old-item": 3 });
      });

      act(() => {
        result.current.saveActiveList(
          makeSavedData(new Map([["new-item", 1]])),
        );
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({ "new-item": 1 });
      });

      // Old item should be gone
      expect(result.current.activeList?.items).not.toHaveProperty("old-item");
    });

    it("can save an empty cart", async () => {
      const list = makeList({ items: { "sword-1": 2 } });
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({ "sword-1": 2 });
      });

      act(() => {
        result.current.saveActiveList(makeSavedData(new Map()));
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({});
      });
    });

    it("saves discounts alongside items", async () => {
      const list = makeList();
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList).toBeDefined();
      });

      act(() => {
        result.current.saveActiveList(
          makeSavedData(
            new Map([
              ["sword-1", 2],
              ["potion-1", 5],
            ]),
            new Map<string, PriceModifier>([
              ["sword-1", { type: "flat", cp: 200 }],
              ["potion-1", { type: "percent", percent: 10 }],
            ]),
          ),
        );
      });

      await waitFor(() => {
        expect(result.current.activeList?.priceModifiers).toEqual({
          "sword-1": { type: "flat", cp: 200 },
          "potion-1": { type: "percent", percent: 10 },
        });
      });

      // Verify localStorage has the discounts
      const stored = getStoredList("list-1");
      expect(stored?.priceModifiers).toEqual({
        "sword-1": { type: "flat", cp: 200 },
        "potion-1": { type: "percent", percent: 10 },
      });
    });

    it("persists discounts through a save/read round-trip", async () => {
      const list = makeList();
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList).toBeDefined();
      });

      act(() => {
        result.current.saveActiveList(
          makeSavedData(
            new Map([["sword-1", 1]]),
            new Map<string, PriceModifier>([
              ["sword-1", { type: "flat", cp: 500 }],
            ]),
          ),
        );
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({ "sword-1": 1 });
      });

      // Simulate a page refresh by reading the stored list back
      const stored = getStoredList("list-1");
      expect(stored).not.toBeNull();
      expect(stored?.items).toEqual({ "sword-1": 1 });
      expect(stored?.priceModifiers).toEqual({
        "sword-1": { type: "flat", cp: 500 },
      });
    });

    it("clears discounts when saving without them", async () => {
      const list = makeList({
        items: { "sword-1": 1 },
        priceModifiers: { "sword-1": { type: "flat", cp: 200 } },
      });
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList?.priceModifiers).toEqual({
          "sword-1": { type: "flat", cp: 200 },
        });
      });

      // Save without discounts
      act(() => {
        result.current.saveActiveList(makeSavedData(new Map([["sword-1", 1]])));
      });

      await waitFor(() => {
        expect(result.current.activeList?.priceModifiers).toBeUndefined();
      });

      const stored = getStoredList("list-1");
      expect(stored?.priceModifiers).toBeUndefined();
    });

    it("saves custom items alongside regular items", async () => {
      const list = makeList();
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList).toBeDefined();
      });

      act(() => {
        result.current.saveActiveList(
          makeSavedData(
            new Map([
              ["sword-1", 2],
              ["custom-1-123", 1],
            ]),
            undefined,
            [{ id: "custom-1-123", name: "Magic Wand", price: { gp: 50 } }],
          ),
        );
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({
          "sword-1": 2,
          "custom-1-123": 1,
        });
      });

      expect(result.current.activeList?.customItems).toEqual([
        { id: "custom-1-123", name: "Magic Wand", price: { gp: 50 } },
      ]);

      // Verify localStorage has the custom items
      const stored = getStoredList("list-1");
      expect(stored?.customItems).toEqual([
        { id: "custom-1-123", name: "Magic Wand", price: { gp: 50 } },
      ]);
    });

    it("persists custom items through a save/read round-trip", async () => {
      const list = makeList();
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList).toBeDefined();
      });

      act(() => {
        result.current.saveActiveList(
          makeSavedData(
            new Map([["custom-1-456", 3]]),
            new Map<string, PriceModifier>([
              ["custom-1-456", { type: "percent", percent: 10 }],
            ]),
            [
              {
                id: "custom-1-456",
                name: "Potion of Speed",
                price: { gp: 12 },
              },
            ],
          ),
        );
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({
          "custom-1-456": 3,
        });
      });

      // Simulate a page refresh by reading the stored list back
      const stored = getStoredList("list-1");
      expect(stored).not.toBeNull();
      expect(stored?.items).toEqual({ "custom-1-456": 3 });
      expect(stored?.customItems).toEqual([
        { id: "custom-1-456", name: "Potion of Speed", price: { gp: 12 } },
      ]);
      expect(stored?.priceModifiers).toEqual({
        "custom-1-456": { type: "percent", percent: 10 },
      });
    });

    it("clears custom items when saving without them", async () => {
      const list = makeList({
        items: { "custom-1-123": 1 },
        customItems: [
          { id: "custom-1-123", name: "Old Custom", price: { sp: 5 } },
        ],
      });
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList?.customItems).toEqual([
          { id: "custom-1-123", name: "Old Custom", price: { sp: 5 } },
        ]);
      });

      // Save without custom items (only regular items)
      act(() => {
        result.current.saveActiveList(makeSavedData(new Map([["sword-1", 1]])));
      });

      await waitFor(() => {
        expect(result.current.activeList?.customItems).toBeUndefined();
      });

      const stored = getStoredList("list-1");
      expect(stored?.customItems).toBeUndefined();
    });
  });

  describe("renameActiveList", () => {
    it("renames the active list", async () => {
      const list = makeList();
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList).toBeDefined();
      });

      act(() => {
        result.current.renameActiveList("My Weapons");
      });

      await waitFor(() => {
        expect(result.current.activeList?.name).toBe("My Weapons");
      });

      expect(getStoredList("list-1")?.name).toBe("My Weapons");
    });

    it("preserves list items after rename", async () => {
      const list = makeList({ items: { "sword-1": 3 } });
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList).toBeDefined();
      });

      act(() => {
        result.current.renameActiveList("Renamed");
      });

      await waitFor(() => {
        expect(result.current.activeList?.name).toBe("Renamed");
      });

      expect(result.current.activeList?.items).toEqual({ "sword-1": 3 });
    });

    it("does not trigger activeListChanged for own renames", async () => {
      const list = makeList();
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeListChanged).toBe(false);
      });

      act(() => {
        result.current.renameActiveList("New Name");
      });

      await waitFor(() => {
        expect(result.current.activeList?.name).toBe("New Name");
      });
      expect(result.current.activeListChanged).toBe(false);
    });
  });

  describe("switchToList", () => {
    it("switches to another list", async () => {
      storeList(
        makeList({
          id: "list-1",
          name: "First",
          savedAt: "2025-02-01T00:00:00.000Z",
        }),
      );
      storeList(
        makeList({
          id: "list-2",
          name: "Second",
          savedAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      act(() => {
        result.current.switchToList("list-2");
      });

      expect(result.current.activeListId).toBe("list-2");
      expect(result.current.activeList?.name).toBe("Second");
      expect(getStoredActiveId()).toBe("list-2");
    });

    it("sets activeListChanged on switch", async () => {
      storeList(
        makeList({
          id: "list-1",
          name: "First",
          savedAt: "2025-02-01T00:00:00.000Z",
        }),
      );
      storeList(
        makeList({
          id: "list-2",
          name: "Second",
          savedAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeListChanged).toBe(false);
      });

      act(() => {
        result.current.switchToList("list-2");
      });

      expect(result.current.activeListChanged).toBe(true);
    });
  });

  describe("deleteList", () => {
    it("deletes a non-active list", async () => {
      storeList(
        makeList({
          id: "list-1",
          name: "Active",
          savedAt: "2025-02-01T00:00:00.000Z",
        }),
      );
      storeList(
        makeList({
          id: "list-2",
          name: "Other",
          savedAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      act(() => {
        result.current.deleteList("list-2");
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      expect(result.current.activeListId).toBe("list-1");
      expect(getStoredList("list-2")).toBeNull();
    });

    it("switches to first remaining list when active list is deleted", async () => {
      storeList(
        makeList({
          id: "list-1",
          name: "First",
          savedAt: "2025-02-01T00:00:00.000Z",
        }),
      );
      storeList(
        makeList({
          id: "list-2",
          name: "Second",
          savedAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      act(() => {
        result.current.deleteList("list-1");
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      expect(result.current.activeListId).toBe("list-2");
      expect(getStoredActiveId()).toBe("list-2");
    });

    it("creates a new default list when the last list is deleted", async () => {
      storeList(makeList({ id: "list-1" }));
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      act(() => {
        result.current.deleteList("list-1");
      });

      await waitFor(() => {
        // A new default list should have been created
        expect(result.current.lists).toHaveLength(1);
        expect(result.current.lists[0].id).not.toBe("list-1");
      });

      expect(result.current.activeList?.name).toBe("Wishlist");
      expect(result.current.activeList?.items).toEqual({});
    });

    it("removes list from localStorage", async () => {
      storeList(
        makeList({
          id: "list-1",
          savedAt: "2025-02-01T00:00:00.000Z",
        }),
      );
      storeList(
        makeList({
          id: "list-2",
          savedAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      act(() => {
        result.current.deleteList("list-2");
      });

      expect(getStoredList("list-2")).toBeNull();
    });
  });

  describe("cross-tab sync via refetch", () => {
    it("detects external changes after query refetch", async () => {
      const list = makeList({ id: "list-1", items: { "sword-1": 1 } });
      storeList(list);
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({ "sword-1": 1 });
      });

      await waitFor(() => {
        expect(result.current.activeListChanged).toBe(false);
      });

      // Simulate another tab writing to localStorage
      storeList({
        ...list,
        items: { "sword-1": 1, "potion-1": 3 },
        savedAt: "2099-01-01T00:00:00.000Z",
      });

      // Trigger a refetch (simulates tab focus)
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ["saved-lists"] });
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({
          "sword-1": 1,
          "potion-1": 3,
        });
      });

      // External change should trigger activeListChanged
      expect(result.current.activeListChanged).toBe(true);
    });

    it("picks up lists created in another tab after refetch", async () => {
      storeList(makeList({ id: "list-1" }));
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      // Another tab creates a new list
      storeList(
        makeList({
          id: "list-2",
          name: "From Other Tab",
          savedAt: "2099-01-01T00:00:00.000Z",
        }),
      );

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ["saved-lists"] });
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      expect(
        result.current.lists.some((l) => l.name === "From Other Tab"),
      ).toBe(true);
      // Active list should remain unchanged
      expect(result.current.activeListId).toBe("list-1");
    });

    it("falls back gracefully when active list is deleted externally", async () => {
      storeList(
        makeList({
          id: "list-1",
          name: "Will Be Deleted",
          savedAt: "2025-02-01T00:00:00.000Z",
        }),
      );
      storeList(
        makeList({
          id: "list-2",
          name: "Survivor",
          savedAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeListId).toBe("list-1");
      });

      // Another tab deletes list-1
      localStorage.removeItem(`${LIST_PREFIX}list-1`);

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ["saved-lists"] });
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      // Should fall back to the surviving list
      expect(result.current.activeListId).toBe("list-2");
      expect(result.current.activeList?.name).toBe("Survivor");
    });
  });

  describe("compound operations", () => {
    it("create then save then switch back", async () => {
      storeList(
        makeList({
          id: "list-1",
          name: "Original",
          items: { "sword-1": 1 },
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeListId).toBe("list-1");
      });

      // Create a new list
      let createdId = "";
      act(() => {
        const newList = result.current.createList("Potions");
        createdId = newList.id;
      });

      await waitFor(() => {
        expect(result.current.activeListId).toBe(createdId);
      });

      // Save some items to it
      act(() => {
        result.current.saveActiveList(
          makeSavedData(new Map([["potion-1", 5]])),
        );
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({ "potion-1": 5 });
      });

      // Switch back to original
      act(() => {
        result.current.switchToList("list-1");
      });

      expect(result.current.activeListId).toBe("list-1");
      expect(result.current.activeList?.items).toEqual({ "sword-1": 1 });

      // The new list should still exist with its items
      const potionsList = result.current.lists.find((l) => l.id === createdId);
      expect(potionsList?.items).toEqual({ "potion-1": 5 });
    });

    it("rename then save preserves both changes", async () => {
      storeList(makeList({ id: "list-1", name: "Old Name" }));
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeList).toBeDefined();
      });

      act(() => {
        result.current.renameActiveList("New Name");
      });

      await waitFor(() => {
        expect(result.current.activeList?.name).toBe("New Name");
      });

      act(() => {
        result.current.saveActiveList(makeSavedData(new Map([["item-1", 2]])));
      });

      await waitFor(() => {
        expect(result.current.activeList?.items).toEqual({ "item-1": 2 });
      });

      // Both name and items should be persisted
      const stored = getStoredList("list-1");
      expect(stored?.name).toBe("New Name");
      expect(stored?.items).toEqual({ "item-1": 2 });
    });

    it("create then immediately save in the same act() persists to the new list", async () => {
      storeList(
        makeList({
          id: "list-1",
          name: "Original",
          items: { "sword-1": 1 },
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeListId).toBe("list-1");
      });

      // Simulate what handleNewList does: createList + saveActiveList
      // in the same synchronous callback (same act block, no re-render in between).
      let createdId = "";
      act(() => {
        const newList = result.current.createList("Copied List");
        createdId = newList.id;
        result.current.saveActiveList(
          makeSavedData(new Map([["potion-1", 3]])),
        );
      });

      await waitFor(() => {
        expect(result.current.activeListId).toBe(createdId);
      });

      // The NEW list should have the copied items
      const newStored = getStoredList(createdId);
      expect(newStored?.items).toEqual({ "potion-1": 3 });

      // The ORIGINAL list should NOT have been modified
      const originalStored = getStoredList("list-1");
      expect(originalStored?.items).toEqual({ "sword-1": 1 });
    });

    it("create multiple lists in sequence", async () => {
      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
      });

      act(() => {
        result.current.createList("First");
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      act(() => {
        result.current.createList("Second");
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(3);
      });

      act(() => {
        result.current.createList("Third");
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(4);
      });

      expect(result.current.activeList?.name).toBe("Third");
      expect(result.current.lists.map((l) => l.name)).toContain("First");
      expect(result.current.lists.map((l) => l.name)).toContain("Second");
    });
  });

  describe("saveListToStorage (shared list import)", () => {
    it("a list saved via saveListToStorage is picked up after refetch", async () => {
      // Start with one existing list
      storeList(
        makeList({
          id: "list-1",
          name: "Original",
          savedAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(1);
        expect(result.current.activeListId).toBe("list-1");
      });

      // Simulate SharedList's "Edit this list" click:
      // saveListToStorage writes the list and sets it as active in localStorage
      saveListToStorage({
        id: "shared-1",
        name: "Shared List",
        items: { "sword-1": 2, "potion-1": 5 },
        savedAt: "2025-06-01T00:00:00.000Z",
      });

      // After refetch (simulates navigation or tab focus), the hook picks it up
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ["saved-lists"] });
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      // The saved list should be available
      const sharedList = result.current.lists.find((l) => l.id === "shared-1");
      expect(sharedList).toBeDefined();
      expect(sharedList?.name).toBe("Shared List");
      expect(sharedList?.items).toEqual({ "sword-1": 2, "potion-1": 5 });
    });

    it("a list saved via saveListToStorage becomes active when switched to", async () => {
      storeList(
        makeList({
          id: "list-1",
          name: "Original",
          savedAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      localStorage.setItem(ACTIVE_KEY, "list-1");

      const { result } = renderHook(() => useSavedLists(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.activeListId).toBe("list-1");
      });

      // Save a shared list
      saveListToStorage({
        id: "shared-1",
        name: "From Share Link",
        items: { "item-1": 3 },
        savedAt: "2025-06-01T00:00:00.000Z",
      });

      // Refetch so the hook sees the new list
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ["saved-lists"] });
      });

      await waitFor(() => {
        expect(result.current.lists).toHaveLength(2);
      });

      // Switch to the shared list
      act(() => {
        result.current.switchToList("shared-1");
      });

      expect(result.current.activeListId).toBe("shared-1");
      expect(result.current.activeList?.name).toBe("From Share Link");
      expect(result.current.activeList?.items).toEqual({ "item-1": 3 });
      expect(result.current.activeListChanged).toBe(true);
    });
  });
});
