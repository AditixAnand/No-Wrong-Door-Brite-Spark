import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchResidentIndexRecord } from '../src/integration/residentIndexClient.js';
import { fetchBenefitsRegisterRecord } from '../src/integration/benefitsRegisterClient.js';
import { SourceNotFoundError, SourceHttpError } from '../src/integration/errors.js';

const noSleep = async () => {};

function jsonRes(status, body) {
  return { ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

test('fetchResidentIndexRecord returns a normalized record on success', async () => {
  const fetchImpl = async () =>
    jsonRes(200, {
      id: 'R-1',
      first_name: 'Paul',
      last_name: 'Quill',
      date_of_birth: '1955-06-10',
      address_line: '261 Sycamore Dr',
      city: 'Weybridge',
      phone: '555-0000',
      program_status: 'Active',
      last_contact: '2025-01-01',
    });

  const record = await fetchResidentIndexRecord('R-1', { fetchImpl, sleepImpl: noSleep });
  assert.equal(record.sourceId, 'R-1');
  assert.equal(record.addressLine, '261 SYCAMORE DRIVE');
});

test('fetchResidentIndexRecord throws SourceNotFoundError on 404, without retrying', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonRes(404, { error: 'not_found' });
  };

  await assert.rejects(
    () => fetchResidentIndexRecord('R-missing', { fetchImpl, sleepImpl: noSleep }),
    SourceNotFoundError
  );
  assert.equal(calls, 1);
});

test('fetchResidentIndexRecord retries on 500 and eventually throws SourceHttpError', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonRes(500, { error: 'boom' });
  };

  await assert.rejects(
    () => fetchResidentIndexRecord('R-1', { fetchImpl, sleepImpl: noSleep, maxAttempts: 3 }),
    SourceHttpError
  );
  assert.equal(calls, 3);
});

const FAULT_500 = '<?xml version="1.0"?><Fault><Code>SRV-500</Code><Message>Retry.</Message></Fault>';
const FAULT_404 = '<?xml version="1.0"?><Fault><Code>SRV-404</Code><Message>No such record</Message></Fault>';
const RECORD_XML = `<?xml version="1.0"?><BenefitsRegister><Record><Ref>X-1</Ref><Name>EASTWOOD, Donna</Name><Born>1973-11-18</Born><Addr>137 Poplar Road</Addr><Town>Ash Hill</Town><BenefitCode>TRN-1</BenefitCode><ReviewDue>2026-06-25</ReviewDue></Record></BenefitsRegister>`;

function xmlRes(ok, status, body) {
  return { ok, status, text: async () => body };
}

test('fetchBenefitsRegisterRecord returns a normalized record on success', async () => {
  const fetchImpl = async () => xmlRes(true, 200, RECORD_XML);
  const record = await fetchBenefitsRegisterRecord('X-1', { fetchImpl, sleepImpl: noSleep });
  assert.equal(record.sourceId, 'X-1');
  assert.equal(record.firstName, 'DONNA');
});

test('fetchBenefitsRegisterRecord throws SourceNotFoundError on SRV-404, without retrying', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return xmlRes(false, 404, FAULT_404);
  };

  await assert.rejects(
    () => fetchBenefitsRegisterRecord('X-missing', { fetchImpl, sleepImpl: noSleep }),
    SourceNotFoundError
  );
  assert.equal(calls, 1);
});

test('fetchBenefitsRegisterRecord retries on SRV-500 then succeeds', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 2) return xmlRes(false, 500, FAULT_500);
    return xmlRes(true, 200, RECORD_XML);
  };

  const record = await fetchBenefitsRegisterRecord('X-1', { fetchImpl, sleepImpl: noSleep, maxAttempts: 3 });
  assert.equal(calls, 2);
  assert.equal(record.sourceId, 'X-1');
});

test('fetchBenefitsRegisterRecord exhausts retries and throws SourceHttpError under sustained failure', async () => {
  const fetchImpl = async () => xmlRes(false, 500, FAULT_500);

  await assert.rejects(
    () => fetchBenefitsRegisterRecord('X-1', { fetchImpl, sleepImpl: noSleep, maxAttempts: 3 }),
    SourceHttpError
  );
});
