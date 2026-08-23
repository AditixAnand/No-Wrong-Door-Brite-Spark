const SOURCE_LABELS = {
  residentIndex: 'Resident Index',
  benefitsRegister: 'Benefits Register',
};

function formatAge(ms) {
  if (ms === null || ms === undefined) return null;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

// Renders exactly one source's status. Never hides a failure and never
// shows missing data as if it were successfully retrieved (SPEC2.md).
// Three visual states, matching the §2.1 status contract: ok (🟢),
// degraded (🟡 — serving stale cached data per F9, still useful), and
// unavailable (🔴).
function SourceStatus({ sourceKey, source, onRetry, retrying }) {
  const label = SOURCE_LABELS[sourceKey] || sourceKey;
  const hasData = source.data !== null;
  const isDegraded = source.status === 'degraded';
  const isUnavailable = source.status === 'unavailable';
  const isOk = source.status === 'ok';

  let cardClass = 'source-down';
  let dot = '🔴';
  if (isOk && hasData) {
    cardClass = 'source-ok';
    dot = '🟢';
  } else if (isOk && !hasData) {
    cardClass = 'source-absent';
    dot = '⚪';
  } else if (isDegraded) {
    cardClass = 'source-degraded';
    dot = '🟡';
  }

  return (
    <div className={`source-card ${cardClass}`}>
      <div className="source-header">
        <span className="source-dot" aria-hidden="true">
          {dot}
        </span>
        <strong>{label}</strong>
        {source.sourceId && <span className="source-id">{source.sourceId}</span>}
      </div>

      {isDegraded && (
        <p className="source-note source-stale-note">
          Live lookup failed{source.error ? ` (${source.error})` : ''} — showing cached data from{' '}
          {formatAge(source.cacheAgeMs)}.
        </p>
      )}

      {(isOk || isDegraded) && hasData && (
        <div className="source-body">
          <dl>
            {Object.entries(source.data).map(([key, value]) => (
              <div key={key} className="source-field">
                <dt>{key}</dt>
                <dd>{value === null || value === undefined || value === '' ? '—' : String(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="source-meta">
            {source.responseTimeMs}ms{source.cached && !isDegraded ? ' (cached)' : ''}
          </p>
        </div>
      )}

      {isOk && !hasData && <p className="source-note">No record found for this resident in this source.</p>}

      {isUnavailable && (
        <p className="source-note source-error">
          {label} did not respond{source.error ? ` (${source.error})` : ''}.{' '}
          {source.responseTimeMs !== null ? `${source.responseTimeMs}ms` : ''}
        </p>
      )}

      {(isUnavailable || isDegraded) && onRetry && (
        <button className="retry-button" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}

export default SourceStatus;
