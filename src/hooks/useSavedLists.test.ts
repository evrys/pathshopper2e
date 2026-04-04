import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type SavedList, readFromStorage } from "./useSavedLists";

const LIST_PREFIX = "pathshopper2e:list:";
const ACTIVE_KEY = "pathshopper2e:active-list-id";

/** Helper to write a list to the mock localStorage. */
function storeList(list: SavedList): void {
  localStorage.setItem(`${LIST_PREFIX}${list.id}`, JSON.stringify(list));
}

/** Simple in-memory localStorage mock. */
function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

beforeEach(() => {
  const mock = createLocalStorageMock();
  vi.stubGlobal("localStorage", mock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readFromStorage", () => {
  it("returns a default list when storage is empty", () => {
    const state = readFromStorage();
    expect(state.lists).toHaveLength(1);
    expect(state.lists[0].name).toBe("Shopping List");
    expect(state.activeListId).toBe(state.lists[0].id);
  });

  it("restores a saved list and active id", () => {
    const list: SavedList = {
      id: "list-1",
      name: "My List",
      items: { w386: 2 },
      savedAt: "2025-01-01T00:00:00.000Z",
    };
    storeList(list);
    localStorage.setItem(ACTIVE_KEY, "list-1");

    const state = readFromStorage();
    expect(state.lists).toHaveLength(1);
    expect(state.lists[0].name).toBe("My List");
    expect(state.activeListId).toBe("list-1");
  });

  it("falls back to first list if active id is invalid", () => {
    storeList({
      id: "list-1",
      name: "First",
      items: {},
      savedAt: "2025-01-02T00:00:00.000Z",
    });
    storeList({
      id: "list-2",
      name: "Second",
      items: {},
      savedAt: "2025-01-01T00:00:00.000Z",
    });
    localStorage.setItem(ACTIVE_KEY, "nonexistent");

    const state = readFromStorage();
    // First by savedAt descending
    expect(state.activeListId).toBe("list-1");
  });

  it("creates a default list when no list keys exist", () => {
    // Only non-list keys in storage
    localStorage.setItem("some-other-key", "value");
    const state = readFromStorage();
    expect(state.lists).toHaveLength(1);
    expect(state.lists[0].name).toBe("Shopping List");
  });

  it("skips list keys with invalid JSON", () => {
    localStorage.setItem(`${LIST_PREFIX}bad`, "not-json");
    storeList({
      id: "list-1",
      name: "Good List",
      items: {},
      savedAt: "2025-01-01T00:00:00.000Z",
    });

    const state = readFromStorage();
    expect(state.lists).toHaveLength(1);
    expect(state.lists[0].name).toBe("Good List");
  });

  it("preserves all list data when restoring", () => {
    storeList({
      id: "list-1",
      name: "Weapons",
      items: { w386: 2, "potion-1": 5 },
      savedAt: "2025-06-15T12:00:00.000Z",
    });
    storeList({
      id: "list-2",
      name: "Armor",
      items: { "armor-1": 1 },
      savedAt: "2025-06-14T12:00:00.000Z",
    });
    localStorage.setItem(ACTIVE_KEY, "list-2");

    const state = readFromStorage();
    expect(state.lists).toHaveLength(2);
    expect(state.activeListId).toBe("list-2");
    // Sorted newest first
    const weapons = state.lists.find((l) => l.name === "Weapons");
    const armor = state.lists.find((l) => l.name === "Armor");
    expect(weapons?.items).toEqual({ w386: 2, "potion-1": 5 });
    expect(armor?.items).toEqual({ "armor-1": 1 });
  });

  it("uses first list id when no active key is set", () => {
    storeList({
      id: "list-1",
      name: "Only List",
      items: {},
      savedAt: "2025-01-01T00:00:00.000Z",
    });
    // No ACTIVE_KEY set

    const state = readFromStorage();
    expect(state.activeListId).toBe("list-1");
  });
});
