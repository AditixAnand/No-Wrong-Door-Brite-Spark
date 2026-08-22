// Decides which REST (Resident Index) and XML (Benefits Register) records
// describe the same person. Works entirely from normalized fields — never
// reads any ground-truth identifier.

const WEIGHTS = {
  dateOfBirth: 40, // high
  lastName: 40, // high
  firstName: 20, // medium
  address: 20, // medium
  town: 10, // low
};

const FIELD_ACCESSORS = {
  dateOfBirth: (r) => r.dateOfBirth,
  lastName: (r) => r.lastName,
  firstName: (r) => r.firstName,
  address: (r) => r.addressLine,
  town: (r) => r.town,
};

// Confidence is normalized against the max score *achievable given the data
// present* (adjustedMax), not a fixed total. Otherwise a blank date of birth
// — which 58 XML records have — would permanently cap confidence even when
// every other signal agrees, unfairly pushing genuine matches into
// "ambiguous" or "unmatched". A field only ever counts toward adjustedMax
// when both sides have a value to compare.
function computeMatchScore(rest, xml) {
  let score = 0;
  let adjustedMax = 0;
  const basis = [];

  for (const [field, weight] of Object.entries(WEIGHTS)) {
    const a = FIELD_ACCESSORS[field](rest);
    const b = FIELD_ACCESSORS[field](xml);
    if (a && b) {
      adjustedMax += weight;
      if (a === b) {
        score += weight;
        basis.push(field);
      }
    }
  }

  const confidence = adjustedMax > 0 ? score / adjustedMax : 0;
  return { score, adjustedMax, confidence, basis };
}

// Real matches always agree on last name after normalization (per SPEC.md:
// "Where records do match, the shared fields agree"), so blocking on exact
// normalized last name is a safe way to avoid an O(restCount * xmlCount)
// full cross join without risking missed matches.
function buildCandidatePairs(restRecords, xmlRecords) {
  const xmlByLastName = new Map();
  for (const x of xmlRecords) {
    if (!x.lastName) continue;
    if (!xmlByLastName.has(x.lastName)) xmlByLastName.set(x.lastName, []);
    xmlByLastName.get(x.lastName).push(x);
  }

  const pairs = [];
  for (const r of restRecords) {
    if (!r.lastName) continue;
    const bucket = xmlByLastName.get(r.lastName);
    if (!bucket) continue;
    for (const x of bucket) {
      const { score, adjustedMax, confidence, basis } = computeMatchScore(r, x);
      pairs.push({ rest: r, xml: x, score, adjustedMax, confidence, basis });
    }
  }
  return pairs;
}

const FLOOR = 0.35;
const AUTO_LINK_THRESHOLD = 0.75;
const AMBIGUITY_MARGIN = 0.1;

// Resolves identity across both sources. Returns confirmed links, ambiguous
// cases surfaced for human review (never auto-resolved), and the records
// left over on each side. Every outcome — including "no match" — is a
// normal, expected result, not a failure.
function resolveEntities(restRecords, xmlRecords, options = {}) {
  const { floor = FLOOR, autoLinkThreshold = AUTO_LINK_THRESHOLD, ambiguityMargin = AMBIGUITY_MARGIN } = options;

  const pairs = buildCandidatePairs(restRecords, xmlRecords);

  const restCandidates = new Map();
  const xmlCandidates = new Map();
  for (const pair of pairs) {
    if (!restCandidates.has(pair.rest.sourceId)) restCandidates.set(pair.rest.sourceId, []);
    restCandidates.get(pair.rest.sourceId).push(pair);
    if (!xmlCandidates.has(pair.xml.sourceId)) xmlCandidates.set(pair.xml.sourceId, []);
    xmlCandidates.get(pair.xml.sourceId).push(pair);
  }
  for (const list of restCandidates.values()) list.sort((a, b) => b.confidence - a.confidence);
  for (const list of xmlCandidates.values()) list.sort((a, b) => b.confidence - a.confidence);

  const ambiguous = [];
  const ambiguousRestIds = new Set();
  const ambiguousXmlIds = new Set();
  const tentative = [];

  for (const r of restRecords) {
    const candidates = restCandidates.get(r.sourceId) || [];
    if (candidates.length === 0) continue;

    const best = candidates[0];
    if (best.confidence < floor) continue;

    // Ambiguity only applies to candidates that would otherwise have
    // qualified for auto-link — two weak, coincidental near-misses (e.g.
    // two different same-surname people who both score 0.5) are not a
    // "close call" between real options, just noise. Without this gate,
    // common surnames in a small name pool produce false ambiguity on a
    // massive scale instead of the few genuine collisions the data has.
    if (best.confidence >= autoLinkThreshold) {
      const second = candidates[1];
      const closeSecond = second && best.confidence - second.confidence < ambiguityMargin;
      if (closeSecond) {
        // Best candidates too close together to call — including the case
        // where a blank DOB removes the one signal that could have
        // separated two same-named candidates.
        ambiguous.push({ candidates: [best, second] });
        ambiguousRestIds.add(r.sourceId);
        ambiguousXmlIds.add(best.xml.sourceId);
        ambiguousXmlIds.add(second.xml.sourceId);
      } else {
        tentative.push(best);
      }
    }
    // Otherwise: best candidate never clears the auto-link bar. Not
    // confident, not ambiguous — falls through to rest-only.
  }

  const claimsByXml = new Map();
  for (const t of tentative) {
    if (!claimsByXml.has(t.xml.sourceId)) claimsByXml.set(t.xml.sourceId, []);
    claimsByXml.get(t.xml.sourceId).push(t);
  }

  const linked = [];
  const linkedRestIds = new Set();
  const linkedXmlIds = new Set();

  for (const [xmlId, claims] of claimsByXml) {
    if (claims.length > 1) {
      // Two or more REST records both confidently claim the same XML
      // record. Never auto-resolve a collision — surface all of them.
      ambiguous.push({ candidates: claims });
      for (const claim of claims) ambiguousRestIds.add(claim.rest.sourceId);
      ambiguousXmlIds.add(xmlId);
      continue;
    }

    const only = claims[0];
    const xmlOwnBest = (xmlCandidates.get(xmlId) || [])[0];

    if (xmlOwnBest && xmlOwnBest.rest.sourceId === only.rest.sourceId) {
      linked.push(only);
      linkedRestIds.add(only.rest.sourceId);
      linkedXmlIds.add(xmlId);
    } else {
      // The XML record's own top preference disagrees with the REST record
      // that claimed it — a genuine cross-perspective disagreement.
      ambiguous.push({ candidates: [only, xmlOwnBest].filter(Boolean) });
      ambiguousRestIds.add(only.rest.sourceId);
      if (xmlOwnBest) ambiguousRestIds.add(xmlOwnBest.rest.sourceId);
      ambiguousXmlIds.add(xmlId);
    }
  }

  const restOnly = restRecords.filter((r) => !linkedRestIds.has(r.sourceId) && !ambiguousRestIds.has(r.sourceId));
  const xmlOnly = xmlRecords.filter((x) => !linkedXmlIds.has(x.sourceId) && !ambiguousXmlIds.has(x.sourceId));

  return {
    linked,
    ambiguous,
    restOnly,
    xmlOnly,
    summary: {
      linked: linked.length,
      ambiguous: ambiguous.length,
      restOnly: restOnly.length,
      xmlOnly: xmlOnly.length,
    },
  };
}

export { computeMatchScore, buildCandidatePairs, resolveEntities, WEIGHTS };
