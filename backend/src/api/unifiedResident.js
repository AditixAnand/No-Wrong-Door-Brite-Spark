import { fetchResidentIndexRecord } from '../integration/residentIndexClient.js';
import { fetchBenefitsRegisterRecord } from '../integration/benefitsRegisterClient.js';
import { aggregateSources } from '../integration/aggregateSources.js';
import { titleCase, toDisplayBasis } from './displayFormat.js';

// Blank DOB is currently only possible on the XML side (F1/F3), but this is
// written to generalize if that ever changes.
function buildDataQuality({ xmlStored }) {
  const notes = [];
  if (xmlStored && xmlStored.dateOfBirth === null) {
    notes.push({ type: 'missing_field', source: 'benefitsRegister', field: 'born' });
  }
  return notes;
}

function buildIdentity(record) {
  if (!record) return null;
  return {
    name: `${titleCase(record.firstName)} ${titleCase(record.lastName)}`.trim(),
    dateOfBirth: record.dateOfBirth,
    address: titleCase(record.addressLine),
    town: titleCase(record.town),
  };
}

// Assembles the unified §2.1 response shape for one resident. Identity comes
// from the already-ingested, always-available MongoDB copy (F2/F3); the
// `sources` section reflects a fresh live call to each source the resident
// actually appears in, aggregated generically so a failing source degrades
// only its own section (F7) and never blanks the whole response.
async function getUnifiedResident(db, unifiedId) {
  const link = await db.collection('links').findOne({ unifiedId });
  if (!link) return null;

  if (link.state === 'ambiguous') {
    // Full review-queue handling is F5; for now, surface the pending
    // candidates rather than guessing or crashing. Every candidate shares
    // the same name (that's what makes it a collision), so it's safe to
    // show for display even though the underlying record is still unknown.
    const firstCandidateId = link.candidates[0].residentIndexId;
    const restForDisplay = firstCandidateId
      ? await db.collection('resident_index').findOne({ sourceId: firstCandidateId })
      : null;
    return {
      unifiedId,
      identity: buildIdentity(restForDisplay),
      match: { state: 'ambiguous', confidence: null, basis: [], candidates: link.candidates },
      sources: {},
      dataQuality: [
        {
          type: 'ambiguous_identity',
          message: `${link.candidates.length} candidate residents pending review.`,
        },
      ],
      overallStatus: 'unavailable',
    };
  }

  const [restStored, xmlStored] = await Promise.all([
    link.residentIndexId ? db.collection('resident_index').findOne({ sourceId: link.residentIndexId }) : null,
    link.benefitsRegisterId ? db.collection('benefits_register').findOne({ sourceId: link.benefitsRegisterId }) : null,
  ]);

  const identity = buildIdentity(restStored || xmlStored);

  const sourceCalls = {};
  if (link.residentIndexId) sourceCalls.residentIndex = () => fetchResidentIndexRecord(link.residentIndexId);
  if (link.benefitsRegisterId) sourceCalls.benefitsRegister = () => fetchBenefitsRegisterRecord(link.benefitsRegisterId);

  const { sources: liveSources, overallStatus } = await aggregateSources(sourceCalls);

  const sources = {};
  for (const [key, sourceId] of [
    ['residentIndex', link.residentIndexId],
    ['benefitsRegister', link.benefitsRegisterId],
  ]) {
    if (!sourceId) {
      // F8 state 2: resident genuinely not present in this source — not an
      // error, so status is "ok" with null data.
      sources[key] = { status: 'ok', sourceId: null, responseTimeMs: null, cached: false, data: null };
      continue;
    }
    const live = liveSources[key];
    sources[key] = {
      status: live.status,
      sourceId,
      responseTimeMs: live.responseTimeMs,
      cached: live.cached,
      ...(live.error ? { error: live.error } : {}),
      data: live.data ? live.data.raw : null,
    };
  }

  return {
    unifiedId,
    identity,
    match: {
      state: link.state,
      confidence: link.confidence,
      basis: toDisplayBasis(link.basis),
      reviewed: Boolean(link.reviewed),
    },
    sources,
    dataQuality: buildDataQuality({ xmlStored }),
    overallStatus,
  };
}

export { getUnifiedResident };
