import { computeSuccessRateOverTime, computeRetryStats, detectFailureSpike } from './reliabilityMetrics.js';

const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // last hour of call-log history

async function getReliabilitySummary(db, { windowMs = DEFAULT_WINDOW_MS } = {}) {
  const since = new Date(Date.now() - windowMs);
  const calls = await db.collection('call_log').find({ timestamp: { $gte: since } }).sort({ timestamp: 1 }).toArray();

  return {
    successRateOverTime: computeSuccessRateOverTime(calls),
    retryStats: computeRetryStats(calls),
    spikeAlerts: detectFailureSpike(calls),
  };
}

export { getReliabilitySummary };
