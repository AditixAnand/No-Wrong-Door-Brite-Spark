import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingestResidentIndex } from '../src/ingestion/restIngestion.js';

function fakeRecord(id) {
  return {
    id,
    first_name: 'Test',
    last_name: `Person${id}`,
    date_of_birth: '1990-01-01',
    address_line: '1 Main St',
    city: 'Weybridge',
    phone: '555-000-0000',
    program_status: 'Active',
    last_contact: '2025-01-01',
  };
}

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

const silentLogger = { log: () => {}, warn: () => {} };

test('dedupes overlapping pages by id (the boundary-slip trap)', async () => {
  // Page 1: ids 1-5. Page 2 slips back and repeats ids 4-5, then adds 6-8.
  const pages = [
    { page: 1, page_size: 5, total: 8, has_more: true, results: [1, 2, 3, 4, 5].map(fakeRecord) },
    { page: 2, page_size: 5, total: 8, has_more: false, results: [4, 5, 6, 7, 8].map(fakeRecord) },
  ];
  const fetchImpl = async (url) => {
    const page = Number(new URL(url).searchParams.get('page'));
    return jsonResponse(pages[page - 1]);
  };

  const result = await ingestResidentIndex({ fetchImpl, logger: silentLogger });

  assert.equal(result.totalRows, 10);
  assert.equal(result.duplicates, 2);
  assert.equal(result.records.length, 8);
  assert.equal(result.stoppedEarly, null);
});

test('stops once has_more is false', async () => {
  const fetchImpl = async () =>
    jsonResponse({ page: 1, page_size: 25, total: 1, has_more: false, results: [fakeRecord(1)] });

  const result = await ingestResidentIndex({ fetchImpl, logger: silentLogger });

  assert.equal(result.pagesFetched, 1);
  assert.equal(result.records.length, 1);
});

test('guards against a page cap being exceeded (non-terminating loop)', async () => {
  // has_more never goes false — simulates a misbehaving source.
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    return jsonResponse({
      page: call,
      page_size: 1,
      total: 999,
      has_more: true,
      results: [fakeRecord(call)], // always a new id, so the stall guard won't trip
    });
  };

  const result = await ingestResidentIndex({ fetchImpl, maxPages: 5, logger: silentLogger });

  assert.equal(result.pagesFetched, 5);
  assert.match(result.stoppedEarly, /page cap/);
});

test('guards against consecutive stalled pages that add no new ids', async () => {
  // has_more stays true forever, but every page repeats the same ids.
  const fetchImpl = async () =>
    jsonResponse({
      page: 1,
      page_size: 3,
      total: 3,
      has_more: true,
      results: [1, 2, 3].map(fakeRecord),
    });

  const result = await ingestResidentIndex({ fetchImpl, maxStallPages: 3, maxPages: 100, logger: silentLogger });

  assert.equal(result.records.length, 3);
  assert.match(result.stoppedEarly, /no new ids/);
  // 1 page to populate + 3 stalled repeats before the guard trips.
  assert.equal(result.pagesFetched, 4);
});

test('throws on an unexpected HTTP status rather than silently continuing', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });

  await assert.rejects(() => ingestResidentIndex({ fetchImpl, logger: silentLogger }), /unexpected status 500/);
});
