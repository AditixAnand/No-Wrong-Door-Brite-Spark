import { useEffect, useState } from 'react';
import { getResident } from '../api.js';
import SourceStatus from './SourceStatus.jsx';

const OVERALL_LABELS = {
  complete: { icon: '✅', text: 'Complete — all sources available' },
  partial: { icon: '⚠️', text: 'Partial data — one or more sources unavailable' },
  unavailable: { icon: '⛔', text: 'Unavailable — no source data could be retrieved' },
};

function formatDataQualityNote(note) {
  if (note.type === 'missing_field' && note.field === 'born') {
    return `Date of birth not recorded (${note.source}).`;
  }
  return note.message || `${note.type}: ${note.source || ''} ${note.field || ''}`;
}

function ResidentDetail({ unifiedId, onBack }) {
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryingKey, setRetryingKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getResident(unifiedId)
      .then((data) => {
        if (!cancelled) setResident(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unifiedId]);

  // F7: "the dashboard ... shows the Benefits section as unavailable with a
  // retry affordance." A fresh fetch is enough — the backend always attempts
  // a live call again once the short cache TTL has passed.
  async function handleRetry(sourceKey) {
    setRetryingKey(sourceKey);
    try {
      const data = await getResident(unifiedId);
      setResident(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRetryingKey(null);
    }
  }

  return (
    <div className="resident-detail">
      <button onClick={onBack} className="back-button">
        ← Back to search
      </button>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && !resident && <p>Resident not found.</p>}

      {resident && resident.match.state === 'ambiguous' && (
        <div className="ambiguous-panel">
          <h2>{resident.identity?.name || 'Ambiguous identity'} — pending review</h2>
          <p>{resident.dataQuality[0]?.message}</p>
          <div className="candidate-list">
            {resident.match.candidates.map((c, i) => (
              <div key={i} className="candidate-card">
                <p>
                  <strong>Resident Index:</strong> {c.residentIndexId}
                </p>
                <p>
                  <strong>Benefits Register:</strong> {c.benefitsRegisterId}
                </p>
                <p>
                  Confidence: {(c.confidence * 100).toFixed(0)}% — basis: {c.basis.join(', ') || 'none'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {resident && resident.match.state !== 'ambiguous' && (
        <>
          <h2>{resident.identity?.name}</h2>
          <p className="identity-line">
            {resident.identity?.dateOfBirth || 'DOB not recorded'} · {resident.identity?.address} ·{' '}
            {resident.identity?.town}
          </p>

          <div className={`match-banner match-${resident.match.state}`}>
            Match: <strong>{resident.match.state}</strong>
            {resident.match.confidence !== null && ` (${(resident.match.confidence * 100).toFixed(0)}% confidence)`}
          </div>

          <div className={`overall-banner overall-${resident.overallStatus}`}>
            {(OVERALL_LABELS[resident.overallStatus] || {}).icon} {(OVERALL_LABELS[resident.overallStatus] || {}).text || resident.overallStatus}
          </div>

          <div className="source-grid">
            {Object.entries(resident.sources).map(([key, source]) => (
              <SourceStatus
                key={key}
                sourceKey={key}
                source={source}
                onRetry={() => handleRetry(key)}
                retrying={retryingKey === key}
              />
            ))}
          </div>

          {resident.dataQuality.length > 0 && (
            <div className="data-quality">
              <h3>Data quality notes</h3>
              <ul>
                {resident.dataQuality.map((note, i) => (
                  <li key={i}>{formatDataQualityNote(note)}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ResidentDetail;
