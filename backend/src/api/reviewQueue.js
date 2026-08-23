import { recordDecision } from '../matching/reviewDecisions.js';
import { runResolution } from '../matching/runEntityResolution.js';
import { titleCase } from './displayFormat.js';

async function getReviewQueue(db) {
  const ambiguousLinks = await db.collection('links').find({ state: 'ambiguous' }).sort({ unifiedId: 1 }).toArray();

  return Promise.all(
    ambiguousLinks.map(async (link) => {
      const candidates = await Promise.all(
        link.candidates.map(async (c) => {
          const [restDoc, xmlDoc] = await Promise.all([
            db.collection('resident_index').findOne({ sourceId: c.residentIndexId }),
            db.collection('benefits_register').findOne({ sourceId: c.benefitsRegisterId }),
          ]);
          return {
            residentIndexId: c.residentIndexId,
            benefitsRegisterId: c.benefitsRegisterId,
            score: c.score,
            confidence: c.confidence,
            basis: c.basis,
            resident: restDoc
              ? {
                  name: `${titleCase(restDoc.firstName)} ${titleCase(restDoc.lastName)}`.trim(),
                  dateOfBirth: restDoc.dateOfBirth,
                  address: titleCase(restDoc.addressLine),
                  town: titleCase(restDoc.town),
                }
              : null,
            benefits: xmlDoc
              ? {
                  name: `${titleCase(xmlDoc.firstName)} ${titleCase(xmlDoc.lastName)}`.trim(),
                  dateOfBirth: xmlDoc.dateOfBirth,
                  address: titleCase(xmlDoc.addressLine),
                  town: titleCase(xmlDoc.town),
                }
              : null,
          };
        })
      );
      return { unifiedId: link.unifiedId, candidates };
    })
  );
}

// Confirms or rejects one specific (residentIndexId, benefitsRegisterId)
// candidate pair, then immediately re-runs resolution so the queue and the
// unified API reflect the decision right away — not just on next ingestion.
async function decideReviewItem(db, { residentIndexId, benefitsRegisterId, decision, decidedBy, reason }) {
  await recordDecision(db, { residentIndexId, benefitsRegisterId, decision, decidedBy, reason });
  const { resolution } = await runResolution(db);
  return resolution.summary;
}

export { getReviewQueue, decideReviewItem };
