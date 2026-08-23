import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSuccessRateOverTime, computeRetryStats, detectFailureSpike } from '../src/health/reliabilityMetrics.js';

function call({ source = 'benefitsRegister', outcome = 'ok', attempts = 1, timestamp }) {
  return { source, outcome, attempts, durationMs: 100, timestamp };
}

test('computeSuccessRateOverTime buckets calls by minute and computes per-bucket rate', () => {
  const t0 = new Date('2026-01-01T00:00:10Z');
  const t1 = new Date('2026-01-01T00:00:50Z'); // same minute bucket as t0
  const t2 = new Date('2026-01-01T00:01:05Z'); // next minute bucket

  const calls = [
    call({ outcome: 'ok', timestamp: t0 }),
    call({ outcome: 'unavailable', timestamp: t1 }),
    call({ outcome: 'ok', timestamp: t2 }),
  ];

  const buckets = computeSuccessRateOverTime(calls);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].totalCalls, 2);
  assert.equal(buckets[0].successRate, 0.5);
  assert.equal(buckets[1].totalCalls, 1);
  assert.equal(buckets[1].successRate, 1);
});

test('computeSuccessRateOverTime keeps sources separate', () => {
  const t = new Date();
  const calls = [
    call({ source: 'residentIndex', outcome: 'ok', timestamp: t }),
    call({ source: 'benefitsRegister', outcome: 'unavailable', timestamp: t }),
  ];
  const buckets = computeSuccessRateOverTime(calls);
  assert.equal(buckets.length, 2);
  const rest = buckets.find((b) => b.source === 'residentIndex');
  const xml = buckets.find((b) => b.source === 'benefitsRegister');
  assert.equal(rest.successRate, 1);
  assert.equal(xml.successRate, 0);
});

test('computeRetryStats counts calls that needed more than one attempt', () => {
  const calls = [
    call({ attempts: 1 }),
    call({ attempts: 3 }),
    call({ attempts: 2 }),
    call({ attempts: 1 }),
  ];
  const stats = computeRetryStats(calls);
  assert.equal(stats.benefitsRegister.totalCalls, 4);
  assert.equal(stats.benefitsRegister.callsWithRetries, 2);
  assert.equal(stats.benefitsRegister.maxAttempts, 3);
  assert.equal(stats.benefitsRegister.meanAttempts, 1.75);
});

test('detectFailureSpike does not alert with too few recent calls', () => {
  const now = Date.now();
  const calls = [call({ outcome: 'unavailable', timestamp: new Date(now - 1000) })];
  const result = detectFailureSpike(calls, { now, minCalls: 5 });
  assert.equal(result.benefitsRegister.alert, false);
});

test('detectFailureSpike alerts when failure rate rises sharply vs. the prior window', () => {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const calls = [];
  // Prior window: 10 calls, all healthy (baseline ~0% failure). Offset by an
  // extra second so none land exactly on the recentStart boundary.
  for (let i = 0; i < 10; i++) {
    calls.push(call({ outcome: 'ok', timestamp: new Date(now - windowMs - 1000 - i * 1000) }));
  }
  // Recent window: 10 calls, 8 failing (80% failure — a real spike).
  for (let i = 0; i < 10; i++) {
    calls.push(call({ outcome: i < 8 ? 'unavailable' : 'ok', timestamp: new Date(now - i * 1000) }));
  }

  const result = detectFailureSpike(calls, { now, windowMs, minCalls: 5 });
  assert.equal(result.benefitsRegister.alert, true);
  assert.equal(result.benefitsRegister.recentFailureRate, 0.8);
  assert.equal(result.benefitsRegister.priorFailureRate, 0);
});

test('detectFailureSpike does not alert when failure rate stays low and stable', () => {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const calls = [];
  for (let i = 0; i < 10; i++) {
    calls.push(call({ outcome: 'ok', timestamp: new Date(now - windowMs - 1000 - i * 1000) }));
    calls.push(call({ outcome: 'ok', timestamp: new Date(now - i * 1000) }));
  }

  const result = detectFailureSpike(calls, { now, windowMs, minCalls: 5 });
  assert.equal(result.benefitsRegister.alert, false);
});

test('detectFailureSpike does not alert on a mild, sub-threshold failure rate', () => {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const calls = [];
  for (let i = 0; i < 10; i++) {
    calls.push(call({ outcome: 'ok', timestamp: new Date(now - windowMs - 1000 - i * 1000) }));
  }
  // 1 in 10 recent calls fails (10%) — below the 15% meaningful floor.
  for (let i = 0; i < 10; i++) {
    calls.push(call({ outcome: i === 0 ? 'unavailable' : 'ok', timestamp: new Date(now - i * 1000) }));
  }

  const result = detectFailureSpike(calls, { now, windowMs, minCalls: 5 });
  assert.equal(result.benefitsRegister.alert, false);
});
