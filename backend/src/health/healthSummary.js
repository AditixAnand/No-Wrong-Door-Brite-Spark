import { computeSourceHealth } from './computeHealth.js';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // rolling 15-minute window

// Queries the call_log for a rolling window and computes per-source health.
// Every known source is included even with zero calls in the window (status
// "unknown"), so the panel never silently drops a source.
async function getHealthSummary(db, { windowMs = DEFAULT_WINDOW_MS } = {}) {
  const since = new Date(Date.now() - windowMs);
  const calls = await db.collection('call_log').find({ timestamp: { $gte: since } }).sort({ timestamp: -1 }).toArray();

  const bySource = {};
  for (const call of calls) {
    if (!bySource[call.source]) bySource[call.source] = [];
    bySource[call.source].push(call);
  }

  const knownSources = new Set(['residentIndex', 'benefitsRegister', ...Object.keys(bySource)]);
  const summary = {};
  for (const source of knownSources) {
    summary[source] = computeSourceHealth(bySource[source] || []);
  }
  return summary;
}

export { getHealthSummary };
