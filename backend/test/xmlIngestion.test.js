import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRetry, parseFault, ingestBenefitsRegister } from '../src/ingestion/xmlIngestion.js';

const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };
const noSleep = async () => {};

const FAULT_500 = '<?xml version="1.0"?><Fault><Code>SRV-500</Code><Message>Register temporarily unavailable. Retry.</Message></Fault>';
const FAULT_404 = '<?xml version="1.0"?><Fault><Code>SRV-404</Code><Message>No such record</Message></Fault>';

function textResponse(ok, status, body) {
  return { ok, status, text: async () => body };
}

test('parseFault extracts code and message from a Fault body', () => {
  assert.deepEqual(parseFault(FAULT_500), { code: 'SRV-500', message: 'Register temporarily unavailable. Retry.' });
  assert.deepEqual(parseFault(FAULT_404), { code: 'SRV-404', message: 'No such record' });
});

test('parseFault returns nulls for a non-Fault body rather than throwing', () => {
  assert.deepEqual(parseFault('not xml at all'), { code: null, message: null });
});

test('fetchWithRetry retries SRV-500 up to maxAttempts then gives up', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return textResponse(false, 500, FAULT_500);
  };

  const result = await fetchWithRetry('/records', {
    fetchImpl,
    maxAttempts: 3,
    sleepImpl: noSleep,
    logger: silentLogger,
  });

  assert.equal(calls, 3);
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 3);
  assert.equal(result.retryable, true);
});

test('fetchWithRetry never retries SRV-404', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return textResponse(false, 404, FAULT_404);
  };

  const result = await fetchWithRetry('/records/AS/2024/9999', {
    fetchImpl,
    maxAttempts: 3,
    sleepImpl: noSleep,
    logger: silentLogger,
  });

  assert.equal(calls, 1);
  assert.equal(result.ok, false);
  assert.equal(result.retryable, false);
  assert.equal(result.fault.code, 'SRV-404');
});

test('fetchWithRetry succeeds after transient SRV-500 failures', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) return textResponse(false, 500, FAULT_500);
    return textResponse(true, 200, '<ok/>');
  };

  const result = await fetchWithRetry('/records', {
    fetchImpl,
    maxAttempts: 3,
    sleepImpl: noSleep,
    logger: silentLogger,
  });

  assert.equal(calls, 3);
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
});

test('fetchWithRetry treats a timeout as a retryable failure', async () => {
  // Simulates a hang: only resolves if the abort signal never fires within
  // the test's short timeout, so a real timeout must trigger the abort path.
  const hangingFetchImpl = (url, { signal } = {}) =>
    new Promise((resolve, reject) => {
      signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

  const result = await fetchWithRetry('/records', {
    fetchImpl: hangingFetchImpl,
    timeoutMs: 20,
    maxAttempts: 2,
    sleepImpl: noSleep,
    logger: silentLogger,
  });

  assert.equal(result.ok, false);
  assert.equal(result.attempts, 2);
  assert.match(result.error.message, /aborted/);
});

test('ingestBenefitsRegister normalizes a multi-record XML body', async () => {
  const xml = `<?xml version="1.0"?>
<BenefitsRegister>
  <Record><Ref>AS/2024/4702</Ref><Name>EASTWOOD, Donna</Name><Born>1973-11-18</Born><Addr>137 Poplar Road</Addr><Town>Ash Hill</Town><BenefitCode>TRN-1</BenefitCode><ReviewDue>2026-06-25</ReviewDue></Record>
  <Record><Ref>NO/2019/4664</Ref><Name>FARROW, William</Name><Born>1966-02-17</Born><Addr>424 Maple Drive</Addr><Town>Northgate</Town><BenefitCode>HSP-B</BenefitCode><ReviewDue>2026-02-18</ReviewDue></Record>
</BenefitsRegister>`;
  const fetchImpl = async () => textResponse(true, 200, xml);

  const result = await ingestBenefitsRegister({ fetchImpl, sleepImpl: noSleep, logger: silentLogger });

  assert.equal(result.success, true);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].sourceId, 'AS/2024/4702');
  assert.equal(result.records[0].firstName, 'DONNA');
  assert.equal(result.records[1].town, 'NORTHGATE');
});

test('ingestBenefitsRegister handles a single-record body (fast-xml-parser array gotcha)', async () => {
  const xml = `<?xml version="1.0"?>
<BenefitsRegister>
  <Record><Ref>AS/2024/4702</Ref><Name>EASTWOOD, Donna</Name><Born>1973-11-18</Born><Addr>137 Poplar Road</Addr><Town>Ash Hill</Town><BenefitCode>TRN-1</BenefitCode><ReviewDue>2026-06-25</ReviewDue></Record>
</BenefitsRegister>`;
  const fetchImpl = async () => textResponse(true, 200, xml);

  const result = await ingestBenefitsRegister({ fetchImpl, sleepImpl: noSleep, logger: silentLogger });

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].sourceId, 'AS/2024/4702');
});

test('ingestBenefitsRegister treats a blank Born as null, not an error', async () => {
  const xml = `<?xml version="1.0"?>
<BenefitsRegister>
  <Record><Ref>AS/2024/4702</Ref><Name>EASTWOOD, Donna</Name><Born></Born><Addr>137 Poplar Road</Addr><Town>Ash Hill</Town><BenefitCode>TRN-1</BenefitCode><ReviewDue>2026-06-25</ReviewDue></Record>
</BenefitsRegister>`;
  const fetchImpl = async () => textResponse(true, 200, xml);

  const result = await ingestBenefitsRegister({ fetchImpl, sleepImpl: noSleep, logger: silentLogger });

  assert.equal(result.records[0].dateOfBirth, null);
});

test('ingestBenefitsRegister does not throw when all attempts fail — reports failure instead', async () => {
  const fetchImpl = async () => textResponse(false, 500, FAULT_500);

  const result = await ingestBenefitsRegister({ fetchImpl, maxAttempts: 3, sleepImpl: noSleep, logger: silentLogger });

  assert.equal(result.success, false);
  assert.equal(result.records, null);
  assert.match(result.reason, /SRV-500/);
});
