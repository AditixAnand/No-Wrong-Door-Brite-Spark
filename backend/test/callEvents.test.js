import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callEvents } from '../src/health/callEvents.js';
import { fetchResidentIndexRecord } from '../src/integration/residentIndexClient.js';
import { fetchBenefitsRegisterRecord } from '../src/integration/benefitsRegisterClient.js';
import { SourceNotFoundError } from '../src/integration/errors.js';

const noSleep = async () => {};

function jsonRes(status, body) {
  return { ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

test('a successful Resident Index call reports outcome ok with attempts=1', async () => {
  const events = [];
  const listener = (e) => events.push(e);
  callEvents.on('call', listener);

  const fetchImpl = async () =>
    jsonRes(200, {
      id: 'R-1',
      first_name: 'A',
      last_name: 'B',
      date_of_birth: '2000-01-01',
      address_line: '1 Main St',
      city: 'Weybridge',
      phone: '555',
      program_status: 'Active',
      last_contact: '2025-01-01',
    });

  await fetchResidentIndexRecord('R-1', { fetchImpl, sleepImpl: noSleep });
  callEvents.off('call', listener);

  assert.equal(events.length, 1);
  assert.equal(events[0].source, 'residentIndex');
  assert.equal(events[0].outcome, 'ok');
  assert.equal(events[0].attempts, 1);
  assert.equal(typeof events[0].durationMs, 'number');
});

test('a Resident Index 404 reports outcome not_found, not unavailable', async () => {
  const events = [];
  const listener = (e) => events.push(e);
  callEvents.on('call', listener);

  const fetchImpl = async () => jsonRes(404, { error: 'not_found' });

  await assert.rejects(() => fetchResidentIndexRecord('R-missing', { fetchImpl, sleepImpl: noSleep }), SourceNotFoundError);
  callEvents.off('call', listener);

  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, 'not_found');
  assert.equal(events[0].attempts, 1);
});

test('exhausting retries reports outcome unavailable with the full attempt count', async () => {
  const events = [];
  const listener = (e) => events.push(e);
  callEvents.on('call', listener);

  const fetchImpl = async () => jsonRes(500, { error: 'boom' });

  await assert.rejects(() => fetchResidentIndexRecord('R-1', { fetchImpl, sleepImpl: noSleep, maxAttempts: 3 }));
  callEvents.off('call', listener);

  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, 'unavailable');
  assert.equal(events[0].attempts, 3);
});

test('a Benefits Register call that succeeds after retries reports the true attempt count', async () => {
  const events = [];
  const listener = (e) => events.push(e);
  callEvents.on('call', listener);

  let calls = 0;
  const RECORD_XML = `<?xml version="1.0"?><BenefitsRegister><Record><Ref>X-1</Ref><Name>A, B</Name><Born>2000-01-01</Born><Addr>1 Main St</Addr><Town>Weybridge</Town><BenefitCode>HSP-A</BenefitCode><ReviewDue>2026-01-01</ReviewDue></Record></BenefitsRegister>`;
  const FAULT_500 = '<?xml version="1.0"?><Fault><Code>SRV-500</Code><Message>Retry.</Message></Fault>';
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 2) return { ok: false, status: 500, text: async () => FAULT_500 };
    return { ok: true, status: 200, text: async () => RECORD_XML };
  };

  await fetchBenefitsRegisterRecord('X-1', { fetchImpl, sleepImpl: noSleep, maxAttempts: 3 });
  callEvents.off('call', listener);

  assert.equal(events.length, 1);
  assert.equal(events[0].source, 'benefitsRegister');
  assert.equal(events[0].outcome, 'ok');
  assert.equal(events[0].attempts, 2);
});
