import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { SavedList } from "../hooks/useSavedLists";
import styles from "./SavedListsModal.module.css";

interface SavedListsModalProps {
  lists: SavedList[];
  onLoad: (list: SavedList) => void;
  onDelete: (name: string) => void;
  onClose: () => void;
}

export function SavedListsModal({
  lists,
  onLoad,
  onDelete,
  onClose,
}: SavedListsModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

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
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

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
              return (
                <li key={list.name} className={styles.listItem}>
                  <button
                    type="button"
                    className={styles.loadBtn}
                    onClick={() => onLoad(list)}
                  >
                    <span className={styles.listName}>{list.name}</span>
                    <span className={styles.listMeta}>
                      {itemCount} item{itemCount !== 1 ? "s" : ""} · {savedDate}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => onDelete(list.name)}
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
    </div>,
    document.body,
  );
}
