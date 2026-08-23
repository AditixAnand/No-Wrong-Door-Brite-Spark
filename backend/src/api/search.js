import { titleCase } from './displayFormat.js';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Searches the local unified index (never the live source services — search
// must stay fast and available even if a source is degraded) by name, town,
// or either source's own id.
async function searchResidents(db, { q = '', page = 1, pageSize = 25 } = {}) {
  const query = String(q || '').trim();
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  let linkQuery = {};
  if (query) {
    const words = query.split(/\s+/).filter(Boolean);

    // A full "First Last" query can't match firstName or lastName alone —
    // neither field contains the whole string. Require every word to match
    // somewhere (name or town) instead, so "Ashley Kessler" finds a record
    // with firstName ASHLEY and lastName KESSLER even though no single
    // field holds "ASHLEY KESSLER".
    const sourceMatchQuery =
      words.length > 1
        ? {
            $and: words.map((word) => {
              const wordRegex = new RegExp(escapeRegex(word.toUpperCase()));
              return { $or: [{ firstName: wordRegex }, { lastName: wordRegex }, { town: wordRegex }] };
            }),
          }
        : {
            $or: [
              { firstName: new RegExp(escapeRegex(query.toUpperCase())) },
              { lastName: new RegExp(escapeRegex(query.toUpperCase())) },
              { town: new RegExp(escapeRegex(query.toUpperCase())) },
              { sourceId: new RegExp(escapeRegex(query), 'i') },
            ],
          };

    const [restMatches, xmlMatches] = await Promise.all([
      db.collection('resident_index').find(sourceMatchQuery).project({ sourceId: 1 }).toArray(),
      db.collection('benefits_register').find(sourceMatchQuery).project({ sourceId: 1 }).toArray(),
    ]);

    const restIds = restMatches.map((r) => r.sourceId);
    const xmlIds = xmlMatches.map((x) => x.sourceId);

    if (restIds.length === 0 && xmlIds.length === 0) {
      return { results: [], total: 0, page: safePage, pageSize };
    }

    // Ambiguous link docs have no top-level residentIndexId/benefitsRegisterId
    // (see persistLinks.js) — the underlying records only exist inside
    // `candidates`. Without matching on that too, an ambiguous resident is
    // invisible to search entirely, findable only via the future review queue.
    linkQuery = {
      $or: [
        { residentIndexId: { $in: restIds } },
        { benefitsRegisterId: { $in: xmlIds } },
        { 'candidates.residentIndexId': { $in: restIds } },
        { 'candidates.benefitsRegisterId': { $in: xmlIds } },
      ],
    };
  }

  const allLinks = await db.collection('links').find(linkQuery).sort({ unifiedId: 1 }).toArray();
  const total = allLinks.length;
  const startIdx = (safePage - 1) * pageSize;
  const pageLinks = allLinks.slice(startIdx, startIdx + pageSize);

  const results = await Promise.all(
    pageLinks.map(async (link) => {
      if (link.state === 'ambiguous') {
        // Every candidate in a collision shares the same first+last name
        // (that's what makes it a collision) — safe to show it for display
        // even though which underlying record is correct is still unknown.
        const firstCandidateId = link.candidates[0].residentIndexId;
        const restDoc = firstCandidateId
          ? await db.collection('resident_index').findOne({ sourceId: firstCandidateId })
          : null;
        return {
          unifiedId: link.unifiedId,
          name: restDoc ? `${titleCase(restDoc.firstName)} ${titleCase(restDoc.lastName)}`.trim() : null,
          town: restDoc ? titleCase(restDoc.town) : null,
          state: 'ambiguous',
        };
      }
      const [restDoc, xmlDoc] = await Promise.all([
        link.residentIndexId ? db.collection('resident_index').findOne({ sourceId: link.residentIndexId }) : null,
        link.benefitsRegisterId ? db.collection('benefits_register').findOne({ sourceId: link.benefitsRegisterId }) : null,
      ]);
      const src = restDoc || xmlDoc;
      return {
        unifiedId: link.unifiedId,
        name: src ? `${titleCase(src.firstName)} ${titleCase(src.lastName)}`.trim() : null,
        town: src ? titleCase(src.town) : null,
        state: link.state,
      };
    })
  );

  return { results, total, page: safePage, pageSize };
}

export { searchResidents };
