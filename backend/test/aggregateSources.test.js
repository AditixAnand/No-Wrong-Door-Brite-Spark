import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSources } from '../src/integration/aggregateSources.js';
import { SourceNotFoundError, SourceHttpError, SourceInvalidResponseError } from '../src/integration/errors.js';

test('all sources succeed -> overallStatus complete', async () => {
  const result = await aggregateSources({
    housing: async () => ({ ok: true }),
    employment: async () => ({ ok: true }),
  });

  assert.equal(result.overallStatus, 'complete');
  assert.equal(result.sources.housing.status, 'ok');
  assert.equal(result.sources.employment.status, 'ok');
});

test('one of several sources fails -> overallStatus partial, others unaffected', async () => {
  const result = await aggregateSources({
    housing: async () => ({ ok: true }),
    benefits: async () => {
      throw new SourceHttpError(500, 'boom');
    },
    employment: async () => ({ ok: true }),
  });

  assert.equal(result.overallStatus, 'partial');
  assert.equal(result.sources.housing.status, 'ok');
  assert.equal(result.sources.employment.status, 'ok');
  assert.equal(result.sources.benefits.status, 'unavailable');
  assert.equal(result.sources.benefits.error, 'HTTP 500');
  assert.equal(result.sources.benefits.data, null);
});

test('every source fails -> overallStatus unavailable, but the call does not throw', async () => {
  const result = await aggregateSources({
    a: async () => {
      throw new Error('dead');
    },
    b: async () => {
      throw new Error('also dead');
    },
  });

  assert.equal(result.overallStatus, 'unavailable');
  assert.equal(result.sources.a.status, 'unavailable');
  assert.equal(result.sources.b.status, 'unavailable');
});

test('a resident genuinely absent from a source is ok/null, not a failure', async () => {
  const result = await aggregateSources({
    benefits: async () => {
      throw new SourceNotFoundError('not here');
    },
  });

  assert.equal(result.sources.benefits.status, 'ok');
  assert.equal(result.sources.benefits.data, null);
  assert.equal(result.overallStatus, 'complete');
});

test('a timeout (AbortError) is classified cleanly, no stack trace leaked', async () => {
  const result = await aggregateSources({
    slow: async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    },
  });

  assert.equal(result.sources.slow.status, 'unavailable');
  assert.equal(result.sources.slow.error, 'timeout');
});

test('malformed data is classified as invalid response, not a generic crash', async () => {
  const result = await aggregateSources({
    weird: async () => {
      throw new SourceInvalidResponseError('bad xml');
    },
  });

  assert.equal(result.sources.weird.status, 'unavailable');
  assert.equal(result.sources.weird.error, 'invalid response');
});

test('every source carries responseTimeMs and cached, regardless of outcome', async () => {
  const result = await aggregateSources({
    ok: async () => 'data',
    fail: async () => {
      throw new Error('x');
    },
  });

  for (const src of Object.values(result.sources)) {
    assert.equal(typeof src.responseTimeMs, 'number');
    assert.equal(src.cached, false);
  }
});

test('is genuinely generic: works the same for an arbitrary set of source names', async () => {
  const result = await aggregateSources({
    housing: async () => 'ok',
    benefits: async () => {
      throw new SourceHttpError(500, 'down');
    },
    employment: async () => 'ok',
    healthcare: async () => {
      throw new SourceNotFoundError('absent');
    },
  });

  assert.equal(result.overallStatus, 'partial');
  assert.equal(result.sources.housing.status, 'ok');
  assert.equal(result.sources.employment.status, 'ok');
  assert.equal(result.sources.benefits.status, 'unavailable');
  assert.equal(result.sources.healthcare.status, 'ok');
  assert.equal(result.sources.healthcare.data, null);
});
