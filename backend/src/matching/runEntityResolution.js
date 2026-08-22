import { connectMongo, closeMongo } from '../db/mongo.js';
import { resolveEntities } from './entityResolution.js';
import { persistLinks } from './persistLinks.js';

const EXPECTED = { linked: 340, restOnly: 280, xmlOnly: 200 };

async function main() {
  const db = await connectMongo();
  const restRecords = await db.collection('resident_index').find({}).toArray();
  const xmlRecords = await db.collection('benefits_register').find({}).toArray();

  if (restRecords.length === 0 || xmlRecords.length === 0) {
    console.error('Entity resolution: resident_index or benefits_register is empty — run ingestion (F2/F3) first.');
    process.exitCode = 1;
    await closeMongo();
    return;
  }

  const resolution = resolveEntities(restRecords, xmlRecords);
  const { count } = await persistLinks(db, resolution);

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

main().catch((err) => {
  console.error('Entity resolution failed:', err);
  process.exitCode = 1;
});
