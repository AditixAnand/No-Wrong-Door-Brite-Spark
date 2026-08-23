import { useEffect, useState } from 'react';
import { getAuditLog } from '../api.js';

function describeEntry(entry) {
  if (entry.action === 'view_resident') {
    return `viewed resident ${entry.unifiedId}`;
  }
  if (entry.action === 'confirm' || entry.action === 'reject') {
    const d = entry.details || {};
    return `${entry.action}ed match: ${d.residentIndexId} ↔ ${d.benefitsRegisterId}${
      d.reason ? ` — "${d.reason}"` : ''
    }`;
  }
  return `${entry.action} ${entry.unifiedId || ''}`;
}

// F13: "Every resident record access recorded in MongoDB: who, which
// unified resident, what action, when. Also record review-queue decisions
// — who linked or rejected which pair, and why."
function AuditLog() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAuditLog()
      .then((data) => setEntries(data.entries))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!entries) return <p>Loading audit log…</p>;
  if (entries.length === 0) return <p>No audit entries yet.</p>;

  return (
    <div className="audit-log">
      <h2>Audit Log</h2>
      <table className="audit-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry._id}>
              <td>{new Date(entry.timestamp).toLocaleString()}</td>
              <td>{entry.who}</td>
              <td>{describeEntry(entry)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AuditLog;
