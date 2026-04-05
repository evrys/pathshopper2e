import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import type { SavedList } from "../hooks/useSavedLists";
import styles from "./SavedListsModal.module.css";

interface SavedListsModalProps {
  lists: SavedList[];
  activeListId: string;
  initialCreatingNew?: boolean;
  onLoad: (list: SavedList) => void;
  onDelete: (id: string) => void;
  onNewList: (name: string, copyItems?: boolean) => void;
  onClose: () => void;
}

export function SavedListsModal({
  lists,
  activeListId,
  initialCreatingNew = false,
  onLoad,
  onDelete,
  onNewList,
  onClose,
}: SavedListsModalProps) {
  const [creatingNew, setCreatingNew] = useState(initialCreatingNew);
  const [newName, setNewName] = useState("");
  const [copyItems, setCopyItems] = useState(false);
  const [deletingList, setDeletingList] = useState<SavedList | null>(null);
  const newNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingNew) {
      newNameInputRef.current?.focus();
    }
  }, [creatingNew]);

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onNewList(trimmed, copyItems);
    setCreatingNew(false);
    setNewName("");
    setCopyItems(false);
    onClose();
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.panel}
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => {
            if (deletingList) {
              e.preventDefault();
              setDeletingList(null);
            } else if (creatingNew) {
              e.preventDefault();
              setCreatingNew(false);
              setNewName("");
              setCopyItems(false);
            }
          }}
        >
          <div className={styles.panelHeader}>
            <Dialog.Title asChild>
              <h2>Saved Lists</h2>
            </Dialog.Title>
            <Dialog.Close className={styles.closeBtn} aria-label="Close">
              ✕
            </Dialog.Close>
          </div>

          <p className={styles.storageNote}>Saved locally to this browser</p>

          {lists.length === 0 && !creatingNew ? (
            <p className={styles.empty}>No saved lists yet.</p>
          ) : (
            <ul className={styles.listItems}>
              {lists.map((list) => {
                const itemCount = Object.values(list.items).reduce(
                  (s, q) => s + q,
                  0,
                );
                const savedDate = new Date(list.savedAt).toLocaleDateString();
                const isActive = list.id === activeListId;
                return (
                  <li
                    key={list.id}
                    className={`${styles.listItem} ${isActive ? styles.activeItem : ""}`}
                  >
                    <button
                      type="button"
                      className={styles.loadBtn}
                      onClick={() => onLoad(list)}
                    >
                      <span className={styles.listName}>{list.name}</span>
                      <span className={styles.listMeta}>
                        {itemCount} item{itemCount !== 1 ? "s" : ""} ·{" "}
                        {savedDate}
                        {isActive && " · current"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => setDeletingList(list)}
                      aria-label={`Delete "${list.name}"`}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!creatingNew ? (
            <button
              type="button"
              className={styles.newListBtn}
              onClick={() => setCreatingNew(true)}
            >
              + New list
            </button>
          ) : (
            <form className={styles.newListForm} onSubmit={handleCreateSubmit}>
              <div className={styles.newListRow}>
                <input
                  ref={newNameInputRef}
                  className={styles.newListInput}
                  type="text"
                  placeholder="List name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <button
                  type="submit"
                  className={styles.newListSubmit}
                  disabled={!newName.trim()}
                >
                  Create
                </button>
                <button
                  type="button"
                  className={styles.newListCancel}
                  onClick={() => {
                    setCreatingNew(false);
                    setNewName("");
                    setCopyItems(false);
                  }}
                >
                  Cancel
                </button>
              </div>
              {activeListId &&
                Object.keys(
                  lists.find((l) => l.id === activeListId)?.items ?? {},
                ).length > 0 && (
                  <label className={styles.copyCheckbox}>
                    <input
                      type="checkbox"
                      checked={copyItems}
                      onChange={(e) => setCopyItems(e.target.checked)}
                    />
                    Copy items from current list
                  </label>
                )}
            </form>
          )}

          {deletingList && (
            <Dialog.Root
              open
              onOpenChange={(open) => !open && setDeletingList(null)}
            >
              <Dialog.Portal>
                <Dialog.Overlay className={styles.confirmOverlay} />
                <Dialog.Content
                  className={styles.confirmPanel}
                  aria-describedby={undefined}
                >
                  <Dialog.Title className={styles.confirmText}>
                    Delete <strong>{deletingList.name}</strong>?
                  </Dialog.Title>
                  <div className={styles.confirmActions}>
                    <button
                      type="button"
                      className={styles.confirmDeleteBtn}
                      onClick={() => {
                        onDelete(deletingList.id);
                        setDeletingList(null);
                      }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className={styles.confirmCancelBtn}
                      onClick={() => setDeletingList(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
