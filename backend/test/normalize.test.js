import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNamePart,
  normalizeSeparateName,
  parseCombinedName,
  normalizeAddress,
  normalizeTown,
  normalizeDate,
} from '../src/normalize/index.js';

test('normalizeNamePart uppercases, trims, strips punctuation', () => {
  assert.equal(normalizeNamePart(" o'brien "), 'OBRIEN');
  assert.equal(normalizeNamePart('Ashley'), 'ASHLEY');
  assert.equal(normalizeNamePart(''), '');
  assert.equal(normalizeNamePart(null), '');
});

test('normalizeSeparateName handles REST first/last fields', () => {
  assert.deepEqual(normalizeSeparateName('Ashley', 'Kessler'), { first: 'ASHLEY', last: 'KESSLER' });
});

test('parseCombinedName splits "SURNAME, Firstname" format', () => {
  assert.deepEqual(parseCombinedName('KESSLER, Ashley'), { first: 'ASHLEY', last: 'KESSLER' });
  assert.deepEqual(parseCombinedName('EASTWOOD, Donna'), { first: 'DONNA', last: 'EASTWOOD' });
});

test('name format inverts but normalizes to the same identity', () => {
  const rest = normalizeSeparateName('Ashley', 'Kessler');
  const xml = parseCombinedName('KESSLER, Ashley');
  assert.deepEqual(rest, xml);
});

test('parseCombinedName with no comma falls back to last-name-only', () => {
  assert.deepEqual(parseCombinedName('Cher'), { first: '', last: 'CHER' });
  assert.deepEqual(parseCombinedName(''), { first: '', last: '' });
});

test('normalizeAddress expands REST abbreviations', () => {
  assert.equal(normalizeAddress('261 Sycamore Dr'), '261 SYCAMORE DRIVE');
  assert.equal(normalizeAddress('118 Cedar Ave'), '118 CEDAR AVENUE');
  assert.equal(normalizeAddress('42 Main St'), '42 MAIN STREET');
  assert.equal(normalizeAddress('7 Birch Ln'), '7 BIRCH LANE');
  assert.equal(normalizeAddress('9 Oak Rd'), '9 OAK ROAD');
});

test('normalizeAddress is a no-op on already-expanded XML addresses', () => {
  assert.equal(normalizeAddress('137 Poplar Road'), '137 POPLAR ROAD');
  assert.equal(normalizeAddress('118 Cedar Avenue'), '118 CEDAR AVENUE');
});

test('normalizeAddress collapses whitespace', () => {
  assert.equal(normalizeAddress('  203   Hazel   St  '), '203 HAZEL STREET');
});

test('REST and XML addresses converge after normalization', () => {
  assert.equal(normalizeAddress('118 Cedar Ave'), normalizeAddress('118 Cedar Avenue'));
});

test('normalizeTown trims and uppercases', () => {
  assert.equal(normalizeTown(' Weybridge '), 'WEYBRIDGE');
  assert.equal(normalizeTown('Ash Hill'), 'ASH HILL');
});

test('normalizeDate passes through valid ISO dates', () => {
  assert.equal(normalizeDate('1973-11-18'), '1973-11-18');
});

test('normalizeDate treats blank as null, never an error', () => {
  assert.equal(normalizeDate(''), null);
  assert.equal(normalizeDate('   '), null);
  assert.equal(normalizeDate(null), null);
  assert.equal(normalizeDate(undefined), null);
});

test('normalizeDate rejects malformed input as null rather than throwing', () => {
  assert.equal(normalizeDate('not-a-date'), null);
});
