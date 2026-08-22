import { XMLParser } from 'fast-xml-parser';
import { adaptXmlRecord } from '../adapters/xmlAdapter.js';

const XML_BASE_URL = process.env.XML_BASE_URL || 'http://127.0.0.1:8082';
// Healthy responses take up to 2.4s — 5s leaves headroom without being so
// long a genuinely dead service hangs the caller.
const TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

const parser = new XMLParser();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The service's error body is XML, not JSON: <Fault><Code>SRV-500</Code>...
function parseFault(xmlText) {
  try {
    const parsed = parser.parse(xmlText);
    if (parsed?.Fault) {
      return { code: parsed.Fault.Code ?? null, message: parsed.Fault.Message ?? null };
    }
  } catch {
    // Not parseable as the expected fault shape — fall through to unknown.
  }
  return { code: null, message: null };
}

// Fetches one path from the Benefits Register with a ~5s timeout and up to
// `maxAttempts` tries. Retries on SRV-500 (and network/timeout errors) with
// jittered exponential backoff; never retries SRV-404.
async function fetchWithRetry(path, {
  baseUrl = XML_BASE_URL,
  fetchImpl = fetch,
  timeoutMs = TIMEOUT_MS,
  maxAttempts = MAX_ATTEMPTS,
  baseDelayMs = BASE_DELAY_MS,
  sleepImpl = sleep,
  logger = console,
} = {}) {
  const url = `${baseUrl}${path}`;
  let lastError = null;
  let lastFault = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: controller.signal });
      clearTimeout(timer);
      const text = await res.text();

      if (res.ok) {
        return { ok: true, body: text, attempts: attempt };
      }

      const fault = parseFault(text);
      lastFault = fault;

      if (fault.code === 'SRV-404') {
        logger.warn(`XML ingestion: ${path} — SRV-404 on attempt ${attempt}, not retrying`);
        return { ok: false, fault, attempts: attempt, retryable: false };
      }

      lastError = new Error(`XML service error ${fault.code || res.status}${fault.message ? `: ${fault.message}` : ''}`);
      logger.warn(`XML ingestion: ${path} — attempt ${attempt}/${maxAttempts} failed (${fault.code || res.status})`);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const reason = err.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : err.message;
      logger.warn(`XML ingestion: ${path} — attempt ${attempt}/${maxAttempts} failed (${reason})`);
    }

    if (attempt < maxAttempts) {
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * backoff * 0.5;
      await sleepImpl(backoff + jitter);
    }
  }

  return { ok: false, error: lastError, fault: lastFault, attempts: maxAttempts, retryable: true };
}

function extractRawRecords(parsedXml) {
  const register = parsedXml?.BenefitsRegister;
  if (!register || !register.Record) return [];
  return Array.isArray(register.Record) ? register.Record : [register.Record];
}

// Fetches and normalizes the full Benefits Register. Never throws: if all
// retry attempts are exhausted, returns success:false so the caller can keep
// whatever the last successful ingestion already persisted.
async function ingestBenefitsRegister(options = {}) {
  const { logger = console } = options;
  const result = await fetchWithRetry('/records', options);

  if (!result.ok) {
    const reason = result.fault?.code
      ? `${result.fault.code} after ${result.attempts} attempt(s)`
      : `${result.error?.message || 'unknown error'} after ${result.attempts} attempt(s)`;
    logger.error(`XML ingestion failed: ${reason}. Keeping previously ingested data.`);
    return { records: null, success: false, reason, attempts: result.attempts };
  }

  const parsed = parser.parse(result.body);
  const rawRecords = extractRawRecords(parsed);
  const records = rawRecords.map(adaptXmlRecord);

  logger.log(`XML ingestion: received ${records.length} records in ${result.attempts} attempt(s)`);
  return { records, success: true, attempts: result.attempts };
}

async function persistBenefitsRegister(db, records) {
  const collection = db.collection('benefits_register');
  if (records.length === 0) return { upsertedCount: 0, modifiedCount: 0 };

  const ops = records.map((record) => ({
    updateOne: {
      filter: { sourceId: record.sourceId },
      update: { $set: record },
      upsert: true,
    },
  }));
  const result = await collection.bulkWrite(ops);
  return { upsertedCount: result.upsertedCount, modifiedCount: result.modifiedCount };
}

export { fetchWithRetry, parseFault, ingestBenefitsRegister, persistBenefitsRegister };
