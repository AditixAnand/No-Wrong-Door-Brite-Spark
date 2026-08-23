import { useEffect, useState } from 'react';
import { getReviewQueue, decideReviewItem } from '../api.js';

function CandidateCard({ candidate, onConfirm, onReject, busy }) {
  const fields = ['name', 'dateOfBirth', 'address', 'town'];
  return (
    <div className="review-candidate">
      <table className="review-compare">
        <thead>
          <tr>
            <th></th>
            <th>Resident Index ({candidate.residentIndexId})</th>
            <th>Benefits Register ({candidate.benefitsRegisterId})</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const agree = candidate.resident?.[field] === candidate.benefits?.[field];
            return (
              <tr key={field} className={agree ? 'field-agree' : 'field-disagree'}>
                <td className="field-name">{field}</td>
                <td>{candidate.resident?.[field] ?? '—'}</td>
                <td>{candidate.benefits?.[field] ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="review-score">
        Score: {candidate.score} — Confidence: {(candidate.confidence * 100).toFixed(0)}% — basis: {candidate.basis.join(', ') || 'none'}
      </p>
      <div className="review-actions">
        <button disabled={busy} className="confirm-button" onClick={onConfirm}>
          Confirm this match
        </button>
        <button disabled={busy} className="reject-button" onClick={onReject}>
          Reject
        </button>
      </div>
    </div>
  );
}

function ReviewQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getReviewQueue();
      setItems(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDecide(candidate, decision) {
    const key = `${candidate.residentIndexId}::${candidate.benefitsRegisterId}`;
    setBusyKey(key);
    try {
      await decideReviewItem({
        residentIndexId: candidate.residentIndexId,
        benefitsRegisterId: candidate.benefitsRegisterId,
        decision,
        decidedBy: 'supervisor',
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <p>Loading review queue…</p>;
  if (error) return <p className="error">{error}</p>;
  if (items.length === 0) return <p>Nothing pending review — every ambiguous match has been resolved.</p>;

  return (
    <div className="review-queue">
      <p className="result-count">{items.length} item{items.length === 1 ? '' : 's'} awaiting review</p>
      {items.map((item) => (
        <div key={item.unifiedId} className="review-item">
          <h3>Ambiguous — {item.candidates[0]?.resident?.name || item.unifiedId}</h3>
          <div className="review-candidate-list">
            {item.candidates.map((c) => (
              <CandidateCard
                key={`${c.residentIndexId}::${c.benefitsRegisterId}`}
                candidate={c}
                busy={busyKey === `${c.residentIndexId}::${c.benefitsRegisterId}`}
                onConfirm={() => handleDecide(c, 'confirm')}
                onReject={() => handleDecide(c, 'reject')}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ReviewQueue;
