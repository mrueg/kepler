interface LoadingBarProps {
  loaded: number;
  total: number;
}

export function LoadingBar({ loaded, total }: LoadingBarProps) {
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;

  return (
    <div className="loading-container">
      <div className="loading-bar-track">
        <div className="loading-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="loading-text">
        Loading KEPs… {loaded}/{total} ({pct}%)
      </div>
    </div>
  );
}
