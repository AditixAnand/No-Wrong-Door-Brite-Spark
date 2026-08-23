import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEntities } from '../src/matching/entityResolution.js';

function restRecord({ id, first, last, dob, address, town }) {
  return { source: 'residentIndex', sourceId: id, firstName: first, lastName: last, dateOfBirth: dob, addressLine: address, town, raw: {} };
}
function xmlRecord({ id, first, last, dob, address, town }) {
  return { source: 'benefitsRegister', sourceId: id, firstName: first, lastName: last, dateOfBirth: dob, addressLine: address, town, raw: {} };
}

// The blank-DOB collision fixture used throughout F4's tests.
function collisionFixture() {
  const rest = [
    restRecord({ id: 'R-1', first: 'WILLIAM', last: 'PEMBERTON', dob: '1999-08-29', address: '1 MAIN STREET', town: 'CALDER CENTRAL' }),
    restRecord({ id: 'R-2', first: 'WILLIAM', last: 'PEMBERTON', dob: '2005-08-27', address: '2 OAK ROAD', town: 'CALDER CENTRAL' }),
  ];
  const xml = [xmlRecord({ id: 'X-1', first: 'WILLIAM', last: 'PEMBERTON', dob: null, address: '1 MAIN STREET', town: 'CALDER CENTRAL' })];
  return { rest, xml };
}

test('a confirmed decision forces a link even without re-litigating the score', () => {
  const { rest, xml } = collisionFixture();
  const baseline = resolveEntities(rest, xml);
  assert.equal(baseline.summary.ambiguous, 1);

  const result = resolveEntities(rest, xml, {
    decisions: { confirmed: [{ residentIndexId: 'R-2', benefitsRegisterId: 'X-1' }] },
  });

  assert.equal(result.summary.ambiguous, 0);
  assert.equal(result.summary.linked, 1);
  const link = result.linked.find((l) => l.rest.sourceId === 'R-2');
  assert.ok(link);
  assert.equal(link.xml.sourceId, 'X-1');
  assert.equal(link.reviewed, true);
});

test('confirming one candidate leaves the other REST record as rest-only, not re-offered as ambiguous', () => {
  const { rest, xml } = collisionFixture();

  const result = resolveEntities(rest, xml, {
    decisions: { confirmed: [{ residentIndexId: 'R-2', benefitsRegisterId: 'X-1' }] },
  });

  assert.equal(result.summary.ambiguous, 0);
  assert.ok(result.restOnly.some((r) => r.sourceId === 'R-1'));
});

test('a rejected pair is never re-offered, even across repeated resolution runs', () => {
  const { rest, xml } = collisionFixture();

  const result = resolveEntities(rest, xml, {
    decisions: { rejected: [{ residentIndexId: 'R-1', benefitsRegisterId: 'X-1' }] },
  });

  // With R-1 excluded from candidacy for X-1, R-2 becomes the sole,
  // unambiguous candidate and should auto-link.
  assert.equal(result.summary.ambiguous, 0);
  assert.equal(result.summary.linked, 1);
  assert.equal(result.linked[0].rest.sourceId, 'R-2');
  assert.ok(result.restOnly.some((r) => r.sourceId === 'R-1'));
});

test('rejecting both candidates in a collision leaves both rest-only and the XML record xml-only', () => {
  const { rest, xml } = collisionFixture();

  const result = resolveEntities(rest, xml, {
    decisions: {
      rejected: [
        { residentIndexId: 'R-1', benefitsRegisterId: 'X-1' },
        { residentIndexId: 'R-2', benefitsRegisterId: 'X-1' },
      ],
    },
  });

  assert.equal(result.summary.ambiguous, 0);
  assert.equal(result.summary.linked, 0);
  assert.equal(result.restOnly.length, 2);
  assert.equal(result.xmlOnly.length, 1);
});

test('decisions are idempotent across repeated resolution runs (simulating re-ingestion)', () => {
  const { rest, xml } = collisionFixture();
  const decisions = { confirmed: [{ residentIndexId: 'R-2', benefitsRegisterId: 'X-1' }] };

  const run1 = resolveEntities(rest, xml, { decisions });
  const run2 = resolveEntities(rest, xml, { decisions });

  assert.deepEqual(run1.summary, run2.summary);
});
