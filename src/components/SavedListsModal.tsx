import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SavedList } from "../hooks/useSavedLists";
import styles from "./SavedListsModal.module.css";

interface SavedListsModalProps {
  lists: SavedList[];
  activeListId: string;
  onLoad: (list: SavedList) => void;
  onDelete: (id: string) => void;
  onNewList: (name: string) => void;
  onClose: () => void;
}

export function SavedListsModal({
  lists,
  activeListId,
  onLoad,
  onDelete,
  onNewList,
  onClose,
}: SavedListsModalProps) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [deletingList, setDeletingList] = useState<SavedList | null>(null);
  const newNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingNew) {
      newNameInputRef.current?.focus();
    }
  }, [creatingNew]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deletingList) {
          setDeletingList(null);
        } else if (creatingNew) {
          setCreatingNew(false);
          setNewName("");
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, creatingNew, deletingList]);

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onNewList(trimmed);
    setCreatingNew(false);
    setNewName("");
    onClose();
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Saved lists"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Saved Lists</h2>
          <div className={styles.panelHeaderActions}>
            <button
              type="button"
              className={styles.newBtn}
              onClick={() => setCreatingNew(true)}
            >
              + New
            </button>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {creatingNew && (
          <form className={styles.newListForm} onSubmit={handleCreateSubmit}>
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
              }}
            >
              Cancel
            </button>
          </form>
        )}

        {lists.length === 0 ? (
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
                <li key={list.id} className={styles.listItem}>
                  <button
                    type="button"
                    className={`${styles.loadBtn} ${isActive ? styles.activeItem : ""}`}
                    onClick={() => onLoad(list)}
                  >
                    <span className={styles.listName}>
                      {list.name}
                      {isActive && (
                        <span className={styles.activeBadge}> (current)</span>
                      )}
                    </span>
                    <span className={styles.listMeta}>
                      {itemCount} item{itemCount !== 1 ? "s" : ""} · {savedDate}
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
      </div>

      {deletingList && (
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeletingList(null);
          }}
        >
          <div className={styles.confirmPanel}>
            <p className={styles.confirmText}>
              Delete <strong>{deletingList.name}</strong>?
            </p>
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
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
