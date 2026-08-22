// Persists a resolveEntities() result to MongoDB as unified-identity link
// records. Each run wipes and rebuilds the 'links' collection from scratch —
// simpler than incrementally reconciling stable ids across re-ingestion, and
// safe because F5's review decisions will be keyed on source-id pairs, not
// on the unifiedId itself, so a decision survives even if a rebuild reissues
// unifiedIds around it.

function toCandidateDoc(pair) {
  return {
    residentIndexId: pair.rest.sourceId,
    benefitsRegisterId: pair.xml.sourceId,
    score: pair.score,
    confidence: pair.confidence,
    basis: pair.basis,
  };
}

function buildLinkDocs(resolution) {
  const docs = [];

  const sortedLinked = [...resolution.linked].sort((a, b) => a.rest.sourceId.localeCompare(b.rest.sourceId));
  for (const pair of sortedLinked) {
    docs.push({ state: 'linked', ...toCandidateDoc(pair) });
  }

  const sortedAmbiguous = [...resolution.ambiguous].sort((a, b) => {
    const keyA = a.candidates[0].rest.sourceId + a.candidates[0].xml.sourceId;
    const keyB = b.candidates[0].rest.sourceId + b.candidates[0].xml.sourceId;
    return keyA.localeCompare(keyB);
  });
  for (const entry of sortedAmbiguous) {
    docs.push({
      state: 'ambiguous',
      residentIndexId: null,
      benefitsRegisterId: null,
      score: null,
      confidence: null,
      basis: null,
      candidates: entry.candidates.map(toCandidateDoc),
    });
  }

  const sortedRestOnly = [...resolution.restOnly].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  for (const rest of sortedRestOnly) {
    docs.push({
      state: 'unmatched_rest_only',
      residentIndexId: rest.sourceId,
      benefitsRegisterId: null,
      score: null,
      confidence: null,
      basis: null,
    });
  }

  const sortedXmlOnly = [...resolution.xmlOnly].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  for (const xml of sortedXmlOnly) {
    docs.push({
      state: 'unmatched_xml_only',
      residentIndexId: null,
      benefitsRegisterId: xml.sourceId,
      score: null,
      confidence: null,
      basis: null,
    });
  }

  return docs.map((doc, index) => ({ unifiedId: `U-${String(index + 1).padStart(4, '0')}`, ...doc }));
}

async function persistLinks(db, resolution) {
  const collection = db.collection('links');
  const docs = buildLinkDocs(resolution);
  await collection.deleteMany({});
  if (docs.length > 0) {
    await collection.insertMany(docs);
  }
  return { count: docs.length };
}

export { buildLinkDocs, persistLinks };
