import { adaptRestRecord } from '../adapters/restAdapter.js';

const REST_BASE_URL = process.env.REST_BASE_URL || 'http://127.0.0.1:8081';
const DEFAULT_PAGE_SIZE = 25;
// Hard safety cap independent of the server's reported `has_more` — guards
// against a non-terminating loop if the source ever misbehaves.
const MAX_PAGE_CAP = 200;
// Consecutive pages that add zero new ids while has_more is still true
// indicate the source is stuck (or lying); stop rather than loop forever.
const MAX_STALL_PAGES = 3;

async function fetchPage(page, { baseUrl = REST_BASE_URL, pageSize = DEFAULT_PAGE_SIZE, fetchImpl = fetch } = {}) {
  const url = `${baseUrl}/residents?page=${page}&page_size=${pageSize}`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`REST ingestion: unexpected status ${res.status} on page ${page}`);
  }
  return res.json();
}

// Pages through /residents, deduplicating by id. Returns normalized records
// plus counters proving the duplicate trap was handled.
async function ingestResidentIndex({
  baseUrl = REST_BASE_URL,
  pageSize = DEFAULT_PAGE_SIZE,
  fetchImpl = fetch,
  maxPages = MAX_PAGE_CAP,
  maxStallPages = MAX_STALL_PAGES,
  logger = console,
} = {}) {
  const seen = new Map(); // sourceId -> normalized record
  let page = 1;
  let totalRows = 0;
  let duplicates = 0;
  let hasMore = true;
  let stallCount = 0;
  let stoppedEarly = null;
  let pagesFetched = 0;

  while (hasMore) {
    if (page > maxPages) {
      stoppedEarly = `exceeded ${maxPages} page cap`;
      logger.warn(`REST ingestion: aborting — ${stoppedEarly} (possible non-terminating loop)`);
      break;
    }

    const body = await fetchPage(page, { baseUrl, pageSize, fetchImpl });
    pagesFetched += 1;
    const sizeBefore = seen.size;

    for (const raw of body.results) {
      totalRows += 1;
      if (seen.has(raw.id)) {
        duplicates += 1;
      } else {
        seen.set(raw.id, adaptRestRecord(raw));
      }
    }

    const newIds = seen.size - sizeBefore;
    stallCount = newIds === 0 && body.results.length > 0 ? stallCount + 1 : 0;

    if (stallCount >= maxStallPages) {
      stoppedEarly = `${maxStallPages} consecutive pages added no new ids`;
      logger.warn(`REST ingestion: aborting — ${stoppedEarly} (possible non-terminating loop)`);
      break;
    }

    hasMore = body.has_more;
    page += 1;
  }

  const records = Array.from(seen.values());
  logger.log(
    `REST ingestion: received ${totalRows} rows, dropped ${duplicates} duplicates, ${records.length} residents indexed`
  );

  return { records, totalRows, duplicates, pagesFetched, stoppedEarly };
}

async function persistResidentIndex(db, records) {
  const collection = db.collection('resident_index');
  if (records.length === 0) return { upsertedCount: 0, modifiedCount: 0 };

  const ops = records.map((record) => ({
    updateOne: {
      filter: { sourceId: record.sourceId },
      update: { $set: record },
      upsert: true,
    },
  }));
  const result = await collection.bulkWrite(ops);
  return { upsertedCount: result.upsertedCount, modifiedCount: result.modifiedCount };
}

export { ingestResidentIndex, persistResidentIndex, fetchPage };
