import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type SavedList, readFromStorage } from "./useSavedLists";

const STORAGE_KEY = "pathshopper2e:saved-lists";
const ACTIVE_KEY = "pathshopper2e:active-list-id";

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

  it("restores saved lists and active id", () => {
    const lists: SavedList[] = [
      {
        id: "list-1",
        name: "My List",
        items: { w386: 2 },
        savedAt: "2025-01-01T00:00:00.000Z",
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    localStorage.setItem(ACTIVE_KEY, "list-1");

    const state = readFromStorage();
    expect(state.lists).toHaveLength(1);
    expect(state.lists[0].name).toBe("My List");
    expect(state.activeListId).toBe("list-1");
  });

  it("falls back to first list if active id is invalid", () => {
    const lists: SavedList[] = [
      {
        id: "list-1",
        name: "First",
        items: {},
        savedAt: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "list-2",
        name: "Second",
        items: {},
        savedAt: "2025-01-01T00:00:00.000Z",
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    localStorage.setItem(ACTIVE_KEY, "nonexistent");

    const state = readFromStorage();
    expect(state.activeListId).toBe("list-1");
  });

  it("creates a default list when stored array is empty", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    const state = readFromStorage();
    expect(state.lists).toHaveLength(1);
    expect(state.lists[0].name).toBe("Shopping List");
  });

  it("creates a default list on invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    const state = readFromStorage();
    expect(state.lists).toHaveLength(1);
    expect(state.lists[0].name).toBe("Shopping List");
  });

  it("preserves all list data when restoring", () => {
    const lists: SavedList[] = [
      {
        id: "list-1",
        name: "Weapons",
        items: { w386: 2, "potion-1": 5 },
        savedAt: "2025-06-15T12:00:00.000Z",
      },
      {
        id: "list-2",
        name: "Armor",
        items: { "armor-1": 1 },
        savedAt: "2025-06-14T12:00:00.000Z",
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    localStorage.setItem(ACTIVE_KEY, "list-2");

    const state = readFromStorage();
    expect(state.lists).toHaveLength(2);
    expect(state.activeListId).toBe("list-2");
    expect(state.lists[0].items).toEqual({ w386: 2, "potion-1": 5 });
    expect(state.lists[1].items).toEqual({ "armor-1": 1 });
  });

  it("uses first list id when no active key is set", () => {
    const lists: SavedList[] = [
      {
        id: "list-1",
        name: "Only List",
        items: {},
        savedAt: "2025-01-01T00:00:00.000Z",
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    // No ACTIVE_KEY set

    const state = readFromStorage();
    expect(state.activeListId).toBe("list-1");
  });
});
