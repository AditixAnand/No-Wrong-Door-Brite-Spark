import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptRestRecord } from '../src/adapters/restAdapter.js';
import { adaptXmlRecord } from '../src/adapters/xmlAdapter.js';

test('adaptRestRecord converts a raw REST record to the common shape', () => {
  const raw = {
    id: 'R-10234',
    first_name: 'Maria',
    last_name: 'Delgado',
    date_of_birth: '1971-04-02',
    address_line: '118 Cedar Ave',
    city: 'Northgate',
    phone: '555-402-9911',
    program_status: 'Active',
    last_contact: '2025-11-30',
  };
  assert.deepEqual(adaptRestRecord(raw), {
    source: 'residentIndex',
    sourceId: 'R-10234',
    firstName: 'MARIA',
    lastName: 'DELGADO',
    dateOfBirth: '1971-04-02',
    addressLine: '118 CEDAR AVENUE',
    town: 'NORTHGATE',
    raw: {
      phone: '555-402-9911',
      programStatus: 'Active',
      lastContact: '2025-11-30',
    },
  });
});

test('adaptXmlRecord converts a raw XML record to the common shape', () => {
  const raw = {
    Ref: 'NO/2019/4234',
    Name: 'DELGADO, Maria',
    Born: '1971-04-02',
    Addr: '118 Cedar Avenue',
    Town: 'Northgate',
    BenefitCode: 'HSP-B',
    ReviewDue: '2026-05-14',
  };
  assert.deepEqual(adaptXmlRecord(raw), {
    source: 'benefitsRegister',
    sourceId: 'NO/2019/4234',
    firstName: 'MARIA',
    lastName: 'DELGADO',
    dateOfBirth: '1971-04-02',
    addressLine: '118 CEDAR AVENUE',
    town: 'NORTHGATE',
    raw: {
      benefitCode: 'HSP-B',
      reviewDue: '2026-05-14',
    },
  });
});

test('adaptXmlRecord with blank Born produces null dateOfBirth, not an error', () => {
  const raw = {
    Ref: 'AS/2024/4702',
    Name: 'EASTWOOD, Donna',
    Born: '',
    Addr: '137 Poplar Road',
    Town: 'Ash Hill',
    BenefitCode: 'HSP-A',
    ReviewDue: '2026-06-25',
  };
  const result = adaptXmlRecord(raw);
  assert.equal(result.dateOfBirth, null);
  assert.equal(result.firstName, 'DONNA');
  assert.equal(result.lastName, 'EASTWOOD');
});

test('matching REST and XML records for the same person normalize identically on shared fields', () => {
  const restRaw = {
    id: 'R-10001',
    first_name: 'Ashley',
    last_name: 'Kessler',
    date_of_birth: '1983-01-23',
    address_line: '203 Hazel St',
    city: 'Calder Central',
    phone: '555-000-0000',
    program_status: 'Active',
    last_contact: '2025-05-04',
  };
  const xmlRaw = {
    Ref: 'CA/2021/4001',
    Name: 'KESSLER, Ashley',
    Born: '1983-01-23',
    Addr: '203 Hazel Street',
    Town: 'Calder Central',
    BenefitCode: 'TRN-1',
    ReviewDue: '2026-01-01',
  };
  const rest = adaptRestRecord(restRaw);
  const xml = adaptXmlRecord(xmlRaw);

  assert.equal(rest.firstName, xml.firstName);
  assert.equal(rest.lastName, xml.lastName);
  assert.equal(rest.dateOfBirth, xml.dateOfBirth);
  assert.equal(rest.addressLine, xml.addressLine);
  assert.equal(rest.town, xml.town);
});
