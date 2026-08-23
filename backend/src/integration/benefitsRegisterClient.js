import { XMLParser } from 'fast-xml-parser';
import { adaptXmlRecord } from '../adapters/xmlAdapter.js';
import { fetchWithTimeout, withRetry } from './httpRetry.js';
import { SourceNotFoundError, SourceHttpError, SourceInvalidResponseError } from './errors.js';

const BASE_URL = process.env.XML_BASE_URL || 'http://127.0.0.1:8082';
const parser = new XMLParser();

function parseFault(xmlText) {
  try {
    const parsed = parser.parse(xmlText);
    if (parsed?.Fault) {
      return { code: parsed.Fault.Code ?? null, message: parsed.Fault.Message ?? null };
    }
  } catch {
    // Not the expected fault shape — fall through to unknown.
  }
  return { code: null, message: null };
}

// Live single-record fetch for the unified API's detail view. Same 5s
// timeout and retry-on-SRV-500/never-retry-SRV-404 rules as F3's bulk
// ingestion, applied per-resident instead of to the whole register.
async function fetchBenefitsRegisterRecord(sourceId, options = {}) {
  const { fetchImpl = fetch, timeoutMs = 5000, maxAttempts = 3, sleepImpl } = options;

  return withRetry(
    async () => {
      const res = await fetchWithTimeout(`${BASE_URL}/records/${encodeURIComponent(sourceId)}`, {
        timeoutMs,
        fetchImpl,
      });
      const text = await res.text();

      if (res.ok) {
        let parsed;
        try {
          parsed = parser.parse(text);
        } catch {
          throw new SourceInvalidResponseError('Benefits Register returned malformed XML');
        }
        const record = parsed?.BenefitsRegister?.Record;
        if (!record) {
          throw new SourceInvalidResponseError('Benefits Register response missing a Record element');
        }
        return adaptXmlRecord(record);
      }

      const fault = parseFault(text);
      if (fault.code === 'SRV-404' || res.status === 404) {
        throw new SourceNotFoundError(`Resident ${sourceId} not found in Benefits Register`);
      }
      throw new SourceHttpError(res.status, `Benefits Register error ${fault.code || res.status}`);
    },
    { maxAttempts, sleepImpl, isRetryable: (err) => !(err instanceof SourceNotFoundError) }
  );
}

export { fetchBenefitsRegisterRecord };
