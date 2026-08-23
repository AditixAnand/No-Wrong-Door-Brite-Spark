import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSourceHealth } from '../src/health/computeHealth.js';

function call({ outcome = 'ok', durationMs = 10, timestamp = new Date() } = {}) {
  return { source: 'test', outcome, durationMs, attempts: 1, timestamp };
}

test('no calls yet reports status unknown, not a false "operational"', () => {
  const result = computeSourceHealth([]);
  assert.equal(result.status, 'unknown');
  assert.equal(result.successRate, null);
});

test('all-success calls are reported operational', () => {
  const calls = Array.from({ length: 10 }, () => call({ outcome: 'ok', durationMs: 20 }));
  const result = computeSourceHealth(calls);
  assert.equal(result.status, 'operational');
  assert.equal(result.successRate, 1);
  assert.equal(result.meanLatencyMs, 20);
});

test('a high failure rate is reported degraded', () => {
  const calls = [
    ...Array.from({ length: 3 }, () => call({ outcome: 'ok' })),
    ...Array.from({ length: 7 }, () => call({ outcome: 'unavailable' })),
  ];
  const result = computeSourceHealth(calls);
  assert.equal(result.status, 'degraded');
  assert.equal(result.successRate, 0.3);
});

test('"not_found" counts as a legitimate outcome, not a failure', () => {
  const calls = [
    ...Array.from({ length: 5 }, () => call({ outcome: 'ok' })),
    ...Array.from({ length: 5 }, () => call({ outcome: 'not_found' })),
  ];
  const result = computeSourceHealth(calls);
  assert.equal(result.successRate, 1);
  assert.equal(result.status, 'operational');
});

test('mean and p95 latency are computed correctly', () => {
  const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const calls = durations.map((d) => call({ durationMs: d }));
  const result = computeSourceHealth(calls);
  assert.equal(result.meanLatencyMs, 55);
  assert.equal(result.p95LatencyMs, 100);
});

test('lastFailureAt reflects the most recent unavailable call, ignoring earlier ones', () => {
  const older = new Date(Date.now() - 60000);
  const newer = new Date();
  const calls = [call({ outcome: 'unavailable', timestamp: older }), call({ outcome: 'unavailable', timestamp: newer }), call({ outcome: 'ok' })];
  const result = computeSourceHealth(calls);
  assert.equal(result.lastFailureAt.getTime(), newer.getTime());
});

test('lastFailureAt is null when there have been no failures', () => {
  const calls = [call({ outcome: 'ok' }), call({ outcome: 'not_found' })];
  const result = computeSourceHealth(calls);
  assert.equal(result.lastFailureAt, null);
});
