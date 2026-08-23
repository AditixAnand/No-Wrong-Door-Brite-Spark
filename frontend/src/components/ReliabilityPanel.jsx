import { useEffect, useState } from 'react';
import { getReliability } from '../api.js';

const SOURCE_LABELS = {
  residentIndex: 'Resident Index',
  benefitsRegister: 'Benefits Register',
};

function SuccessRateTrend({ source, buckets }) {
  const recent = buckets.filter((b) => b.source === source).slice(-20);
  if (recent.length === 0) return <p className="trend-empty">No recent calls.</p>;

  return (
    <div className="trend-bars">
      {recent.map((b, i) => (
        <div
          key={i}
          className="trend-bar"
          title={`${new Date(b.bucketStart).toLocaleTimeString()} — ${(b.successRate * 100).toFixed(0)}% (${b.totalCalls} calls)`}
          style={{
            height: `${Math.max(4, b.successRate * 40)}px`,
            background: b.successRate >= 0.9 ? '#22c55e' : b.successRate >= 0.5 ? '#eab308' : '#ef4444',
          }}
        />
      ))}
    </div>
  );
}

// F14: "per-source success rate over time, retry counts, and an alert when
// the rolling failure rate rises sharply."
function ReliabilityPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const result = await getReliability();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading reliability metrics…</p>;

  const activeAlerts = Object.entries(data.spikeAlerts).filter(([, a]) => a.alert);

  return (
    <div className="reliability-panel">
      <h2>Reliability Metrics</h2>
      <p className="health-window-note">Last hour of call-log history, refreshed every 10s.</p>

      {activeAlerts.length > 0 && (
        <div className="alert-banner">
          {activeAlerts.map(([source, a]) => (
            <span key={source}>
              {SOURCE_LABELS[source] || source} failure rate spiked to {(a.recentFailureRate * 100).toFixed(0)}%
              (was {(a.priorFailureRate * 100).toFixed(0)}%).
            </span>
          ))}
        </div>
      )}

      <h3>Success rate over time</h3>
      {Object.keys(SOURCE_LABELS).map((source) => (
        <div key={source} className="trend-row">
          <span className="trend-label">{SOURCE_LABELS[source]}</span>
          <SuccessRateTrend source={source} buckets={data.successRateOverTime} />
        </div>
      ))}

      <h3>Retry counts</h3>
      <table className="health-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Total calls</th>
            <th>Calls needing retries</th>
            <th>Mean attempts</th>
            <th>Max attempts</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.retryStats).map(([source, stats]) => (
            <tr key={source}>
              <td>{SOURCE_LABELS[source] || source}</td>
              <td>{stats.totalCalls}</td>
              <td>{stats.callsWithRetries}</td>
              <td>{stats.meanAttempts.toFixed(2)}</td>
              <td>{stats.maxAttempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReliabilityPanel;
