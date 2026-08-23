import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordAudit, getAuditLog } from '../src/audit/auditLog.js';
import { connectMongo, closeMongo } from '../src/db/mongo.js';

// Runs against the real local MongoDB (same pattern as F2/F3's ingestion
// tests) — audit_log entries are tagged with a unique test marker and
// cleaned up afterward so this doesn't pollute real data.
const TEST_WHO = `test-auditor-${process.pid}`;

test.after(async () => {
  const db = await connectMongo();
  await db.collection('audit_log').deleteMany({ who: TEST_WHO });
  await closeMongo();
});

test('recordAudit persists who/action/unifiedId/details/timestamp', async () => {
  const db = await connectMongo();
  await recordAudit(db, { who: TEST_WHO, action: 'view_resident', unifiedId: 'U-0001' });

  const entries = await db.collection('audit_log').find({ who: TEST_WHO }).toArray();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].action, 'view_resident');
  assert.equal(entries[0].unifiedId, 'U-0001');
  assert.ok(entries[0].timestamp instanceof Date);
});

test('recordAudit stores review-decision details (who, pair, reason)', async () => {
  const db = await connectMongo();
  await recordAudit(db, {
    who: TEST_WHO,
    action: 'confirm',
    details: { residentIndexId: 'R-1', benefitsRegisterId: 'X-1', reason: 'address matches' },
  });

  const entry = await db.collection('audit_log').findOne({ who: TEST_WHO, action: 'confirm' });
  assert.equal(entry.details.residentIndexId, 'R-1');
  assert.equal(entry.details.reason, 'address matches');
});

test('getAuditLog returns entries newest-first', async () => {
  const db = await connectMongo();
  await recordAudit(db, { who: TEST_WHO, action: 'view_resident', unifiedId: 'U-first' });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await recordAudit(db, { who: TEST_WHO, action: 'view_resident', unifiedId: 'U-second' });

  const entries = await getAuditLog(db, { limit: 200 });
  const mine = entries.filter((e) => e.who === TEST_WHO);
  assert.ok(mine[0].timestamp >= mine[mine.length - 1].timestamp);
});
