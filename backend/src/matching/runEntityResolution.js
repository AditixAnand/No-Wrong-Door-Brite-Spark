import { pathToFileURL } from 'node:url';
import { connectMongo, closeMongo } from '../db/mongo.js';
import { resolveEntities } from './entityResolution.js';
import { persistLinks } from './persistLinks.js';
import { loadDecisions } from './reviewDecisions.js';

const EXPECTED = { linked: 340, restOnly: 280, xmlOnly: 200 };

// Reusable by both the CLI entry point below and the API's review-queue
// route, which re-runs resolution immediately after a supervisor's decision
// so the queue reflects it without waiting for the next ingestion cycle.
async function runResolution(db) {
  const restRecords = await db.collection('resident_index').find({}).toArray();
  const xmlRecords = await db.collection('benefits_register').find({}).toArray();

  if (restRecords.length === 0 || xmlRecords.length === 0) {
    throw new Error('resident_index or benefits_register is empty — run ingestion (F2/F3) first.');
  }

  const decisions = await loadDecisions(db);
  const resolution = resolveEntities(restRecords, xmlRecords, { decisions });
  const { count } = await persistLinks(db, resolution);

  return { resolution, count };
}

async function main() {
  const db = await connectMongo();
  const { resolution, count } = await runResolution(db);

  const { linked, ambiguous, restOnly, xmlOnly } = resolution.summary;
  console.log(
    `Entity resolution: ${linked} linked, ${ambiguous} ambiguous, ${restOnly} rest-only, ${xmlOnly} xml-only ` +
      `(${count} link records persisted)`
  );
  console.log(
    `Expected (ground truth, for gauging quality only): ${EXPECTED.linked} linked, ` +
      `${EXPECTED.restOnly} rest-only, ${EXPECTED.xmlOnly} xml-only`
  );

  await closeMongo();
}

export { runResolution };

// A plain `file://${process.argv[1]}` comparison breaks when the path
// contains spaces or special characters (this project's directory does) —
// pathToFileURL applies the same percent-encoding import.meta.url already has.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Entity resolution failed:', err);
    process.exitCode = 1;
  });
}
