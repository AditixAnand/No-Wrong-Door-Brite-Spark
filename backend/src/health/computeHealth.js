// Below this rolling success rate, a source is reported "degraded" rather
// than "operational" — a starting threshold, easy to retune later.
const DEGRADED_THRESHOLD = 0.9;

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return null;
  const index = Math.min(sortedValues.length - 1, Math.floor(p * sortedValues.length));
  return sortedValues[index];
}

// Computes a rolling health summary from a source's call-log entries. Pure
// function — the caller decides the rolling window (last N calls, last X
// minutes) by choosing what to pass in.
function computeSourceHealth(calls) {
  if (calls.length === 0) {
    return {
      status: 'unknown',
      totalCalls: 0,
      successRate: null,
      meanLatencyMs: null,
      p95LatencyMs: null,
      lastFailureAt: null,
    };
  }

  // "not_found" is a legitimate F8 outcome, not a failure — only
  // "unavailable" counts against the success rate.
  const successCount = calls.filter((c) => c.outcome !== 'unavailable').length;
  const successRate = successCount / calls.length;

  const durations = calls.map((c) => c.durationMs).sort((a, b) => a - b);
  const meanLatencyMs = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
  const p95LatencyMs = percentile(durations, 0.95);

  const failures = calls.filter((c) => c.outcome === 'unavailable');
  const lastFailureAt =
    failures.length > 0
      ? failures.reduce((latest, c) => (c.timestamp > latest ? c.timestamp : latest), failures[0].timestamp)
      : null;

  return {
    status: successRate >= DEGRADED_THRESHOLD ? 'operational' : 'degraded',
    totalCalls: calls.length,
    successRate,
    meanLatencyMs,
    p95LatencyMs,
    lastFailureAt,
  };
}

export { computeSourceHealth, DEGRADED_THRESHOLD };
