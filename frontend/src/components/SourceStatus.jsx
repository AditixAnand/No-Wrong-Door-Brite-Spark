const SOURCE_LABELS = {
  residentIndex: 'Resident Index',
  benefitsRegister: 'Benefits Register',
};

// Renders exactly one source's status. Never hides a failure and never
// shows missing data as if it were successfully retrieved (SPEC2.md).
function SourceStatus({ sourceKey, source }) {
  const label = SOURCE_LABELS[sourceKey] || sourceKey;
  const isOk = source.status === 'ok';
  const hasData = source.data !== null;

  let cardClass = 'source-down';
  let dot = '🔴';
  if (isOk && hasData) {
    cardClass = 'source-ok';
    dot = '🟢';
  } else if (isOk && !hasData) {
    cardClass = 'source-absent';
    dot = '⚪';
  }

  return (
    <div className={`source-card ${cardClass}`}>
      <div className="source-header">
        <span className="source-dot" aria-hidden="true">
          {dot}
        </span>
        <strong>{label}</strong>
      </div>

      {isOk && hasData && (
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
            {source.responseTimeMs}ms{source.cached ? ' (cached)' : ''}
          </p>
        </div>
      )}

      {isOk && !hasData && <p className="source-note">No record found for this resident in this source.</p>}

      {!isOk && (
        <p className="source-note source-error">
          {label} did not respond{source.error ? ` (${source.error})` : ''}.{' '}
          {source.responseTimeMs !== null ? `${source.responseTimeMs}ms` : ''}
        </p>
      )}
    </div>
  );
}

export default SourceStatus;
