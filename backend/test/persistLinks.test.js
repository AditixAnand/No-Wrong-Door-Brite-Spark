import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLinkDocs } from '../src/matching/persistLinks.js';
import { resolveEntities } from '../src/matching/entityResolution.js';

function restRecord(id, overrides = {}) {
  return { sourceId: id, firstName: 'A', lastName: 'B', dateOfBirth: '2000-01-01', addressLine: 'X', town: 'Y', ...overrides };
}
function xmlRecord(id, overrides = {}) {
  return { sourceId: id, firstName: 'A', lastName: 'B', dateOfBirth: '2000-01-01', addressLine: 'X', town: 'Y', ...overrides };
}

test('buildLinkDocs assigns a unique sequential unifiedId to every outcome', () => {
  const rest = [restRecord('R-1'), restRecord('R-2', { lastName: 'ONLY' })];
  const xml = [xmlRecord('X-1'), xmlRecord('X-2', { lastName: 'ONLY-XML' })];

  const resolution = resolveEntities(rest, xml);
  const docs = buildLinkDocs(resolution);

  const ids = docs.map((d) => d.unifiedId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(docs.length, resolution.summary.linked + resolution.summary.ambiguous + resolution.summary.restOnly + resolution.summary.xmlOnly);
});

test('buildLinkDocs stores score/confidence/basis on a linked doc', () => {
  const rest = [restRecord('R-1')];
  const xml = [xmlRecord('X-1')];
  const resolution = resolveEntities(rest, xml);

  const docs = buildLinkDocs(resolution);
  const linkedDoc = docs.find((d) => d.state === 'linked');

  assert.equal(linkedDoc.residentIndexId, 'R-1');
  assert.equal(linkedDoc.benefitsRegisterId, 'X-1');
  assert.equal(linkedDoc.confidence, 1);
  assert.ok(Array.isArray(linkedDoc.basis));
});

test('buildLinkDocs stores both candidates on an ambiguous doc', () => {
  const rest = [restRecord('R-1', { dateOfBirth: null }), restRecord('R-2', { dateOfBirth: null })];
  const xml = [xmlRecord('X-1', { dateOfBirth: null })];
  const resolution = resolveEntities(rest, xml);

  const docs = buildLinkDocs(resolution);
  const ambiguousDoc = docs.find((d) => d.state === 'ambiguous');

  assert.equal(ambiguousDoc.residentIndexId, null);
  assert.equal(ambiguousDoc.candidates.length, 2);
});
