// F14: "From the call log: per-source success rate over time, retry counts,
// and an alert when the rolling failure rate rises sharply."

// Buckets calls into fixed-size time windows and computes a success rate
// per bucket, per source — the "success rate over time" trend.
function computeSuccessRateOverTime(calls, { bucketMs = 60000 } = {}) {
  const byKey = new Map();
  for (const call of calls) {
    const bucketStart = Math.floor(new Date(call.timestamp).getTime() / bucketMs) * bucketMs;
    const key = `${call.source}:${bucketStart}`;
    if (!byKey.has(key)) byKey.set(key, { source: call.source, bucketStart, ok: 0, total: 0 });
    const entry = byKey.get(key);
    entry.total += 1;
    if (call.outcome !== 'unavailable') entry.ok += 1;
  }

  return Array.from(byKey.values())
    .map((b) => ({
      source: b.source,
      bucketStart: new Date(b.bucketStart),
      successRate: b.ok / b.total,
      totalCalls: b.total,
    }))
    .sort((a, b) => a.bucketStart - b.bucketStart);
}

// How often calls needed more than one attempt, per source.
function computeRetryStats(calls) {
  const bySource = {};
  for (const call of calls) {
    if (!bySource[call.source]) {
      bySource[call.source] = { totalCalls: 0, callsWithRetries: 0, totalAttempts: 0, maxAttempts: 0 };
    }
    const s = bySource[call.source];
    s.totalCalls += 1;
    s.totalAttempts += call.attempts;
    if (call.attempts > 1) s.callsWithRetries += 1;
    if (call.attempts > s.maxAttempts) s.maxAttempts = call.attempts;
  }
  for (const s of Object.values(bySource)) {
    s.meanAttempts = s.totalCalls > 0 ? s.totalAttempts / s.totalCalls : 0;
  }
  return bySource;
}

// Compares the failure rate in the most recent window against the window
// immediately before it. Fires only when the recent window has enough calls
// to be meaningful — a single failure in a quiet period shouldn't page
// anyone. This is what BENEFITS_FAILURE_RATE being raised should trigger.
function detectFailureSpike(calls, { windowMs = 5 * 60 * 1000, factor = 2, minCalls = 5, now = Date.now() } = {}) {
  const recentStart = now - windowMs;
  const priorStart = now - 2 * windowMs;

  const bySource = {};
  for (const call of calls) {
    const t = new Date(call.timestamp).getTime();
    if (t < priorStart) continue;
    if (!bySource[call.source]) bySource[call.source] = { recent: [], prior: [] };
    if (t >= recentStart) bySource[call.source].recent.push(call);
    else bySource[call.source].prior.push(call);
  }

  const result = {};
  for (const [source, { recent, prior }] of Object.entries(bySource)) {
    if (recent.length < minCalls) {
      result[source] = { alert: false, reason: 'insufficient recent data', recentFailureRate: null, priorFailureRate: null };
      continue;
    }
    const recentFailureRate = recent.filter((c) => c.outcome === 'unavailable').length / recent.length;
    const priorFailureRate =
      prior.length >= minCalls ? prior.filter((c) => c.outcome === 'unavailable').length / prior.length : 0;

    // A meaningful floor (15%) avoids alerting on e.g. 1-in-6 noise, and the
    // relative-rise check catches a genuine spike even when the prior
    // window had a nonzero baseline failure rate.
    const spiked = recentFailureRate > 0.15 && (priorFailureRate === 0 || recentFailureRate >= priorFailureRate * factor);
    result[source] = { alert: spiked, recentFailureRate, priorFailureRate };
  }
  return result;
}

export { computeSuccessRateOverTime, computeRetryStats, detectFailureSpike };
