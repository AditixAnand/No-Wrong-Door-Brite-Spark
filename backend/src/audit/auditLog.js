// F13: "Every resident record access recorded in MongoDB: who, which
// unified resident, what action, when. Also record review-queue decisions
// — who linked or rejected which pair, and why."

async function recordAudit(db, { who, action, unifiedId = null, details = null }) {
  await db.collection('audit_log').insertOne({ who, action, unifiedId, details, timestamp: new Date() });
}

// Fire-and-forget variant for the request path a record access happens on —
// an audit-log hiccup should never be the reason a caseworker can't see a
// resident. Mirrors how call_log (F11) is written.
function recordAuditAsync(db, event) {
  recordAudit(db, event).catch((err) => {
    console.error('audit_log write failed:', err.message);
  });
}

async function getAuditLog(db, { limit = 200 } = {}) {
  return db.collection('audit_log').find({}).sort({ timestamp: -1 }).limit(limit).toArray();
}

export { recordAudit, recordAuditAsync, getAuditLog };
