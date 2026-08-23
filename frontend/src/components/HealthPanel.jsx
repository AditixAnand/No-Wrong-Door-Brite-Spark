import { useEffect, useState } from 'react';
import { getHealth } from '../api.js';

const SOURCE_LABELS = {
  residentIndex: 'Resident Index (REST)',
  benefitsRegister: 'Benefits Register (XML)',
};

const STATUS_LABELS = {
  operational: { icon: '🟢', text: 'Operational' },
  degraded: { icon: '🟡', text: 'Degraded' },
  unknown: { icon: '⚪', text: 'No recent calls' },
};

function formatLatency(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'never';
  const ms = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

// F11: "Live health panel driven by the API call log. Show rolling success
// rate, mean and p95 latency, and last failure time."
function HealthPanel() {
  const [sources, setSources] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const data = await getHealth();
      setSources(data.sources);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // live panel — auto-refresh
    return () => clearInterval(interval);
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!sources) return <p>Loading source health…</p>;

  return (
    <div className="health-panel">
      <h2>Source Health</h2>
      <p className="health-window-note">Rolling 15-minute window, refreshed every 5s.</p>
      <table className="health-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Status</th>
            <th>Mean latency</th>
            <th>p95 latency</th>
            <th>Success rate</th>
            <th>Last failure</th>
            <th>Calls</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(sources).map(([key, health]) => {
            const label = STATUS_LABELS[health.status] || STATUS_LABELS.unknown;
            return (
              <tr key={key} className={`health-row health-${health.status}`}>
                <td>{SOURCE_LABELS[key] || key}</td>
                <td>
                  {label.icon} {label.text}
                </td>
                <td>{formatLatency(health.meanLatencyMs)}</td>
                <td>{formatLatency(health.p95LatencyMs)}</td>
                <td>{health.successRate !== null ? `${(health.successRate * 100).toFixed(0)}%` : '—'}</td>
                <td>{formatTimeAgo(health.lastFailureAt)}</td>
                <td>{health.totalCalls}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default HealthPanel;
