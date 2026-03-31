import styles from "./VersionTag.module.css";

export function VersionTag() {
  return (
    <span className={styles.version} title={`Build ${__COMMIT_HASH__}`}>
      {__COMMIT_HASH__}
    </span>
  );
}
