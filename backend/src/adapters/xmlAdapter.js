import { parseCombinedName, normalizeAddress, normalizeTown, normalizeDate } from '../normalize/index.js';

// Converts a raw Benefits Register (XML) record — already parsed into a plain
// object with Ref/Name/Born/Addr/Town/BenefitCode/ReviewDue keys — into the
// common internal shape.
function adaptXmlRecord(raw) {
  const { first, last } = parseCombinedName(raw.Name);
  return {
    source: 'benefitsRegister',
    sourceId: raw.Ref,
    firstName: first,
    lastName: last,
    dateOfBirth: normalizeDate(raw.Born),
    addressLine: normalizeAddress(raw.Addr),
    town: normalizeTown(raw.Town),
    raw: {
      benefitCode: raw.BenefitCode ?? null,
      reviewDue: raw.ReviewDue ?? null,
    },
  };
}

export { adaptXmlRecord };
