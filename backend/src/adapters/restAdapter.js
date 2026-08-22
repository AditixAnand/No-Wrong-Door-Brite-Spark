import { normalizeSeparateName, normalizeAddress, normalizeTown, normalizeDate } from '../normalize/index.js';

// Converts a raw Resident Index (REST) record into the common internal shape.
function adaptRestRecord(raw) {
  const { first, last } = normalizeSeparateName(raw.first_name, raw.last_name);
  return {
    source: 'residentIndex',
    sourceId: raw.id,
    firstName: first,
    lastName: last,
    dateOfBirth: normalizeDate(raw.date_of_birth),
    addressLine: normalizeAddress(raw.address_line),
    town: normalizeTown(raw.city),
    raw: {
      phone: raw.phone ?? null,
      programStatus: raw.program_status ?? null,
      lastContact: raw.last_contact ?? null,
    },
  };
}

export { adaptRestRecord };
