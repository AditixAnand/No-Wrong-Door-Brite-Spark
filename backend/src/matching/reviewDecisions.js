// Review decisions are keyed by the natural (residentIndexId, benefitsRegisterId)
// pair — not by unifiedId, which is reassigned on every resolution re-run
// (see persistLinks.js). This is what lets a decision survive re-ingestion:
// the pair is a stable identity even when the surrounding link documents are
// rebuilt from scratch.

function pairKey(residentIndexId, benefitsRegisterId) {
  return `${residentIndexId}::${benefitsRegisterId}`;
}

async function recordDecision(db, { residentIndexId, benefitsRegisterId, decision, decidedBy, reason }) {
  if (decision !== 'confirm' && decision !== 'reject') {
    throw new Error(`Invalid decision "${decision}" — must be "confirm" or "reject"`);
  }
  const collection = db.collection('review_decisions');
  const key = pairKey(residentIndexId, benefitsRegisterId);
  await collection.updateOne(
    { key },
    {
      $set: {
        key,
        residentIndexId,
        benefitsRegisterId,
        decision,
        decidedBy: decidedBy || 'supervisor',
        reason: reason || null,
        decidedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

async function loadDecisions(db) {
  const docs = await db.collection('review_decisions').find({}).toArray();
  const confirmed = docs.filter((d) => d.decision === 'confirm').map((d) => ({
    residentIndexId: d.residentIndexId,
    benefitsRegisterId: d.benefitsRegisterId,
  }));
  const rejected = docs.filter((d) => d.decision === 'reject').map((d) => ({
    residentIndexId: d.residentIndexId,
    benefitsRegisterId: d.benefitsRegisterId,
  }));
  return { confirmed, rejected };
}

export { recordDecision, loadDecisions, pairKey };
