interface LoadingBarProps {
  loaded: number;
  total: number;
  /** What is being loaded, e.g. "KEPs". */
  noun: string;
}

export function LoadingBar({ loaded, total, noun }: LoadingBarProps) {
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;

  return (
    <div className="loading-container">
      <div className="loading-bar-track">
        <div className="loading-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="loading-text">
        Loading {noun}… {loaded}/{total} ({pct}%)
      </div>
    </div>
  );
}

interface LoadStatusProps {
  loading: boolean;
  progress: { loaded: number; total: number };
  error: string | null;
  reload: () => void;
  noun: string;
}

/** Progress bar while loading, and an error box with a retry button on failure. */
export function LoadStatus({ loading, progress, error, reload, noun }: LoadStatusProps) {
  return (
    <>
      {loading && <LoadingBar loaded={progress.loaded} total={progress.total} noun={noun} />}
      {error && (
        <div className="error-box">
          <strong>Error loading {noun}:</strong> {error}
          <button className="retry-btn" onClick={reload}>
            Retry
          </button>
        </div>
      )}
    </>
  );
}
