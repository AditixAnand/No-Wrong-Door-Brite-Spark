import { adaptRestRecord } from '../adapters/restAdapter.js';
import { fetchWithTimeout, withRetry } from './httpRetry.js';
import { SourceNotFoundError, SourceHttpError, SourceInvalidResponseError } from './errors.js';

const BASE_URL = process.env.REST_BASE_URL || 'http://127.0.0.1:8081';

// Live single-record fetch for the unified API's detail view (distinct from
// the bulk paginated fetch used by F2's ingestion). REST has no documented
// failure mode, but it still goes through the same generic timeout/retry
// path as every other source — no special-casing.
async function fetchResidentIndexRecord(sourceId, options = {}) {
  const { fetchImpl = fetch, timeoutMs = 5000, maxAttempts = 3, sleepImpl } = options;

  return withRetry(
    async () => {
      const res = await fetchWithTimeout(`${BASE_URL}/residents/${encodeURIComponent(sourceId)}`, {
        timeoutMs,
        fetchImpl,
      });

      if (res.status === 404) {
        throw new SourceNotFoundError(`Resident ${sourceId} not found in Resident Index`);
      }
      if (!res.ok) {
        throw new SourceHttpError(res.status, `Resident Index returned HTTP ${res.status}`);
      }

      let json;
      try {
        json = await res.json();
      } catch {
        throw new SourceInvalidResponseError('Resident Index returned malformed JSON');
      }
      return adaptRestRecord(json);
    },
    { maxAttempts, sleepImpl, isRetryable: (err) => !(err instanceof SourceNotFoundError) }
  );
}

export { fetchResidentIndexRecord };
