import { getRedisClient } from '../db/redis.js';
import { SourceNotFoundError } from '../integration/errors.js';

// Short TTL per F9 ("short TTL") — long enough to absorb a burst of repeat
// lookups on the same resident, short enough that program_status/lastContact
// changes show up quickly.
const FRESH_TTL_SECONDS = 30;
// A separate, much longer-lived copy kept purely as a degradation fallback.
// This is what lets a failing source still serve *something* useful — the
// spec calls this "the strongest use of cache in this project."
const BACKUP_TTL_SECONDS = 60 * 60 * 24;

function freshKey(source, sourceId) {
  return `cache:fresh:${source}:${sourceId}`;
}

function backupKey(source, sourceId) {
  return `cache:backup:${source}:${sourceId}`;
}

async function readEntry(key) {
  const client = await getRedisClient();
  const raw = await client.get(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

async function writeBoth(source, sourceId, data) {
  const client = await getRedisClient();
  const payload = JSON.stringify({ data, cachedAt: Date.now() });
  await Promise.all([
    client.set(freshKey(source, sourceId), payload, { EX: FRESH_TTL_SECONDS }),
    client.set(backupKey(source, sourceId), payload, { EX: BACKUP_TTL_SECONDS }),
  ]);
}

// Wraps one live source call with cache-first reads and a stale-on-failure
// fallback. Never masks a genuine "not present in this source" result with
// stale data — that's a real, current fact, not something caching should
// second-guess.
async function withCache(source, sourceId, fetchFn) {
  const fresh = await readEntry(freshKey(source, sourceId));
  if (fresh) {
    return { data: fresh.data, cached: true, stale: false, cacheAgeMs: Date.now() - fresh.cachedAt };
  }

  try {
    const data = await fetchFn();
    await writeBoth(source, sourceId, data);
    return { data, cached: false, stale: false, cacheAgeMs: null };
  } catch (err) {
    if (err instanceof SourceNotFoundError) throw err;

    const backup = await readEntry(backupKey(source, sourceId));
    if (backup) {
      return { data: backup.data, cached: true, stale: true, cacheAgeMs: Date.now() - backup.cachedAt };
    }
    throw err;
  }
}

export { withCache };
