import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withCache } from '../src/cache/sourceCache.js';
import { getRedisClient, closeRedis } from '../src/db/redis.js';
import { SourceNotFoundError, SourceHttpError } from '../src/integration/errors.js';

// These run against a real local Redis (started via `brew services start
// redis`) rather than a mock — the cache module talks to a module-level
// singleton client, and faking that out reliably isn't worth the complexity
// for a cache this small. Each test uses a unique source id to stay isolated.
let counter = 0;
function uniqueId() {
  counter += 1;
  return `TEST-${process.pid}-${counter}`;
}

test.after(async () => {
  await closeRedis();
});

test('a cache miss calls the live fetch and stores the result', async () => {
  const id = uniqueId();
  let calls = 0;
  const result = await withCache('testSource', id, async () => {
    calls += 1;
    return { value: 'fresh-data' };
  });

  assert.equal(calls, 1);
  assert.deepEqual(result.data, { value: 'fresh-data' });
  assert.equal(result.cached, false);
  assert.equal(result.stale, false);
});

test('a subsequent call within the TTL is served from cache without calling the live fetch again', async () => {
  const id = uniqueId();
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return { value: 'fresh-data' };
  };

  await withCache('testSource', id, fetchFn);
  const second = await withCache('testSource', id, fetchFn);

  assert.equal(calls, 1); // fetchFn not called the second time
  assert.equal(second.cached, true);
  assert.equal(second.stale, false);
  assert.ok(second.cacheAgeMs >= 0);
});

test('when the live source fails after a prior success, the last-known-good value is served as stale', async () => {
  const id = uniqueId();

  await withCache('testSource', id, async () => ({ value: 'last-good-value' }));

  // Force past the fresh TTL by directly deleting the fresh key, simulating
  // TTL expiry without a 30s sleep in the test suite.
  const client = await getRedisClient();
  await client.del(`cache:fresh:testSource:${id}`);

  const result = await withCache('testSource', id, async () => {
    throw new SourceHttpError(500, 'simulated outage');
  });

  assert.equal(result.cached, true);
  assert.equal(result.stale, true);
  assert.deepEqual(result.data, { value: 'last-good-value' });
});

test('a failure with no prior successful call has nothing to fall back to and rethrows', async () => {
  const id = uniqueId();

  await assert.rejects(
    () =>
      withCache('testSource', id, async () => {
        throw new SourceHttpError(500, 'never succeeded');
      }),
    SourceHttpError
  );
});

test('a genuine "not found" is never masked by stale cached data', async () => {
  const id = uniqueId();

  await withCache('testSource', id, async () => ({ value: 'used-to-exist' }));
  const client = await getRedisClient();
  await client.del(`cache:fresh:testSource:${id}`);

  await assert.rejects(
    () =>
      withCache('testSource', id, async () => {
        throw new SourceNotFoundError('no longer present');
      }),
    SourceNotFoundError
  );
});
