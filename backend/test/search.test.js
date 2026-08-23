import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchResidents } from '../src/api/search.js';
import { connectMongo, closeMongo } from '../src/db/mongo.js';

// Runs against the real local MongoDB (same pattern as other Mongo-backed
// modules) — fixtures use a unique test marker in sourceId/lastName so they
// never collide with real ingested data, and are cleaned up afterward.
const MARK = `TESTSEARCH${process.pid}`;
const REST_ID = `R-${MARK}`;
const XML_ID = `X-${MARK}`;

test.before(async () => {
  const db = await connectMongo();
  await db.collection('resident_index').insertOne({
    sourceId: REST_ID,
    firstName: 'ASHLEYQ',
    lastName: `KESSLERQ${MARK}`,
    dateOfBirth: '1983-01-23',
    addressLine: '203 HAZEL STREET',
    town: 'CALDER CENTRAL',
    raw: {},
  });
  await db.collection('links').insertOne({
    unifiedId: `U-${MARK}`,
    state: 'unmatched_rest_only',
    residentIndexId: REST_ID,
    benefitsRegisterId: null,
    score: null,
    confidence: null,
    basis: null,
  });
});

test.after(async () => {
  const db = await connectMongo();
  await db.collection('resident_index').deleteOne({ sourceId: REST_ID });
  await db.collection('benefits_register').deleteOne({ sourceId: XML_ID });
  await db.collection('links').deleteMany({ residentIndexId: REST_ID });
  await closeMongo();
});

test('a single-word query matches on last name', async () => {
  const db = await connectMongo();
  const result = await searchResidents(db, { q: `KESSLERQ${MARK}` });
  assert.ok(result.results.some((r) => r.unifiedId === `U-${MARK}`));
});

test('a full "First Last" query matches even though no single field holds the whole string', async () => {
  const db = await connectMongo();
  const result = await searchResidents(db, { q: `ASHLEYQ KESSLERQ${MARK}` });
  assert.ok(
    result.results.some((r) => r.unifiedId === `U-${MARK}`),
    'expected the full-name query to find the record split across firstName and lastName'
  );
});

test('a full name query in the wrong field combination still matches (order-independent)', async () => {
  const db = await connectMongo();
  const result = await searchResidents(db, { q: `KESSLERQ${MARK} ASHLEYQ` });
  assert.ok(result.results.some((r) => r.unifiedId === `U-${MARK}`));
});

test('a full name query with a non-matching second word finds nothing', async () => {
  const db = await connectMongo();
  const result = await searchResidents(db, { q: `ASHLEYQ NoSuchLastName${MARK}` });
  assert.ok(!result.results.some((r) => r.unifiedId === `U-${MARK}`));
});
