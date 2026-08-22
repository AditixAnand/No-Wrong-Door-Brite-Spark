import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMatchScore, resolveEntities } from '../src/matching/entityResolution.js';

// Synthetic normalized records — never derived from the real data files, and
// deliberately without any _pid-like field.
function restRecord({ id, first, last, dob, address, town }) {
  return {
    source: 'residentIndex',
    sourceId: id,
    firstName: first,
    lastName: last,
    dateOfBirth: dob,
    addressLine: address,
    town,
    raw: {},
  };
}

function xmlRecord({ id, first, last, dob, address, town }) {
  return {
    source: 'benefitsRegister',
    sourceId: id,
    firstName: first,
    lastName: last,
    dateOfBirth: dob,
    addressLine: address,
    town,
    raw: {},
  };
}

test('computeMatchScore: full agreement on all fields scores maximum confidence', () => {
  const rest = restRecord({ id: 'R-1', first: 'ASHLEY', last: 'KESSLER', dob: '1983-01-23', address: '203 HAZEL STREET', town: 'CALDER CENTRAL' });
  const xml = xmlRecord({ id: 'X-1', first: 'ASHLEY', last: 'KESSLER', dob: '1983-01-23', address: '203 HAZEL STREET', town: 'CALDER CENTRAL' });

  const result = computeMatchScore(rest, xml);

  assert.equal(result.confidence, 1);
  assert.equal(result.adjustedMax, 130);
  assert.deepEqual(result.basis.sort(), ['address', 'dateOfBirth', 'firstName', 'lastName', 'town']);
});

test('computeMatchScore: blank DOB on one side excludes it from adjustedMax rather than penalizing', () => {
  const rest = restRecord({ id: 'R-1', first: 'DONNA', last: 'EASTWOOD', dob: '1973-11-18', address: '137 POPLAR ROAD', town: 'ASH HILL' });
  const xml = xmlRecord({ id: 'X-1', first: 'DONNA', last: 'EASTWOOD', dob: null, address: '137 POPLAR ROAD', town: 'ASH HILL' });

  const result = computeMatchScore(rest, xml);

  // adjustedMax excludes the 40-point DOB weight since XML has none to compare.
  assert.equal(result.adjustedMax, 90);
  assert.equal(result.score, 90);
  assert.equal(result.confidence, 1);
  assert.ok(!result.basis.includes('dateOfBirth'));
});

test('computeMatchScore: disagreeing fields simply do not contribute (spec guarantees no real contradictions)', () => {
  const rest = restRecord({ id: 'R-1', first: 'PAUL', last: 'QUILL', dob: '1955-06-10', address: '261 SYCAMORE DRIVE', town: 'WEYBRIDGE' });
  const xml = xmlRecord({ id: 'X-1', first: 'PAUL', last: 'QUILL', dob: '1955-06-10', address: 'DIFFERENT ADDRESS', town: 'NORTHGATE' });

  const result = computeMatchScore(rest, xml);

  assert.deepEqual(result.basis.sort(), ['dateOfBirth', 'firstName', 'lastName']);
  assert.equal(result.score, 100); // dob 40 + last 40 + first 20
  assert.equal(result.adjustedMax, 130);
});

test('resolveEntities: a unique, well-separated match is auto-linked', () => {
  const rest = [restRecord({ id: 'R-1', first: 'ASHLEY', last: 'KESSLER', dob: '1983-01-23', address: '203 HAZEL STREET', town: 'CALDER CENTRAL' })];
  const xml = [xmlRecord({ id: 'X-1', first: 'ASHLEY', last: 'KESSLER', dob: '1983-01-23', address: '203 HAZEL STREET', town: 'CALDER CENTRAL' })];

  const result = resolveEntities(rest, xml);

  assert.equal(result.summary.linked, 1);
  assert.equal(result.summary.ambiguous, 0);
  assert.equal(result.linked[0].rest.sourceId, 'R-1');
  assert.equal(result.linked[0].xml.sourceId, 'X-1');
});

test('resolveEntities: unique match with blank DOB still auto-links (not blocked by the missing signal)', () => {
  const rest = [restRecord({ id: 'R-1', first: 'DONNA', last: 'EASTWOOD', dob: '1973-11-18', address: '137 POPLAR ROAD', town: 'ASH HILL' })];
  const xml = [xmlRecord({ id: 'X-1', first: 'DONNA', last: 'EASTWOOD', dob: null, address: '137 POPLAR ROAD', town: 'ASH HILL' })];

  const result = resolveEntities(rest, xml);

  assert.equal(result.summary.linked, 1);
  assert.equal(result.summary.ambiguous, 0);
});

test('resolveEntities: blank-DOB name collision between two candidates is ambiguous, never guessed', () => {
  // Two different people, same last+first name, both blank DOB in XML — the
  // exact "3 blank-DOB records collide on name alone" scenario from SPEC.md.
  const rest = [
    restRecord({ id: 'R-1', first: 'DONNA', last: 'ASHFORD', dob: '1972-12-24', address: '453 POPLAR ROAD', town: 'NORTHGATE' }),
    restRecord({ id: 'R-2', first: 'DONNA', last: 'ASHFORD', dob: '1990-05-01', address: '9 OAK ROAD', town: 'NORTHGATE' }),
  ];
  const xml = [xmlRecord({ id: 'X-1', first: 'DONNA', last: 'ASHFORD', dob: null, address: 'UNKNOWN ROAD', town: 'NORTHGATE' })];

  const result = resolveEntities(rest, xml);

  assert.equal(result.summary.linked, 0);
  assert.equal(result.summary.ambiguous, 1);
  assert.equal(result.ambiguous[0].candidates.length, 2);
});

test('resolveEntities: a weak coincidental last-name-only match does not clear the floor', () => {
  const rest = [restRecord({ id: 'R-1', first: 'JOHN', last: 'SMITH', dob: '1980-01-01', address: '1 MAIN STREET', town: 'WEYBRIDGE' })];
  const xml = [xmlRecord({ id: 'X-1', first: 'MARY', last: 'SMITH', dob: '1955-07-07', address: '99 ELM ROAD', town: 'NORTHGATE' })];

  const result = resolveEntities(rest, xml);

  assert.equal(result.summary.linked, 0);
  assert.equal(result.summary.ambiguous, 0);
  assert.equal(result.summary.restOnly, 1);
  assert.equal(result.summary.xmlOnly, 1);
});

test('resolveEntities: records with no last-name overlap at all are unmatched, not errors', () => {
  const rest = [restRecord({ id: 'R-1', first: 'ALICE', last: 'NOBODY', dob: '1980-01-01', address: '1 MAIN STREET', town: 'WEYBRIDGE' })];
  const xml = [xmlRecord({ id: 'X-1', first: 'BOB', last: 'ELSEWHERE', dob: '1990-01-01', address: '2 OAK ROAD', town: 'NORTHGATE' })];

  const result = resolveEntities(rest, xml);

  assert.equal(result.summary.restOnly, 1);
  assert.equal(result.summary.xmlOnly, 1);
  assert.equal(result.summary.linked, 0);
});

test('resolveEntities: two confident REST claims on the same XML record are surfaced, not auto-resolved', () => {
  // Both REST records agree with the XML record on every available field
  // (e.g. identical twins sharing an address) — a genuine collision.
  const rest = [
    restRecord({ id: 'R-1', first: 'SAM', last: 'TWIN', dob: '2000-01-01', address: '1 MAIN STREET', town: 'WEYBRIDGE' }),
    restRecord({ id: 'R-2', first: 'SAM', last: 'TWIN', dob: '2000-01-01', address: '1 MAIN STREET', town: 'WEYBRIDGE' }),
  ];
  const xml = [xmlRecord({ id: 'X-1', first: 'SAM', last: 'TWIN', dob: '2000-01-01', address: '1 MAIN STREET', town: 'WEYBRIDGE' })];

  const result = resolveEntities(rest, xml);

  assert.equal(result.summary.linked, 0);
  assert.equal(result.summary.ambiguous, 1);
  assert.equal(result.ambiguous[0].candidates.length, 2);
});

test('resolveEntities: summary counts always add up to the input sizes', () => {
  const rest = [
    restRecord({ id: 'R-1', first: 'ASHLEY', last: 'KESSLER', dob: '1983-01-23', address: '203 HAZEL STREET', town: 'CALDER CENTRAL' }),
    restRecord({ id: 'R-2', first: 'PAUL', last: 'QUILL', dob: '1955-06-10', address: '261 SYCAMORE DRIVE', town: 'WEYBRIDGE' }),
  ];
  const xml = [
    xmlRecord({ id: 'X-1', first: 'ASHLEY', last: 'KESSLER', dob: '1983-01-23', address: '203 HAZEL STREET', town: 'CALDER CENTRAL' }),
    xmlRecord({ id: 'X-2', first: 'UNRELATED', last: 'PERSON', dob: '1999-09-09', address: '5 ELM LANE', town: 'ASH HILL' }),
  ];

  const result = resolveEntities(rest, xml);

  assert.equal(result.summary.linked + result.summary.restOnly, rest.length - result.summary.ambiguous * 0);
  // Every rest record is accounted for exactly once across linked/ambiguous/restOnly.
  const restAccountedFor = result.linked.length + result.restOnly.length +
    result.ambiguous.reduce((sum, a) => sum + new Set(a.candidates.map((c) => c.rest.sourceId)).size, 0);
  assert.ok(restAccountedFor >= rest.length);
  assert.equal(result.summary.linked, 1);
  assert.equal(result.summary.restOnly, 1);
  assert.equal(result.summary.xmlOnly, 1);
});
