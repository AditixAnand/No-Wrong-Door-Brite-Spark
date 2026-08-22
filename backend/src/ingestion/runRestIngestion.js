import { connectMongo, closeMongo } from '../db/mongo.js';
import { ingestResidentIndex, persistResidentIndex } from './restIngestion.js';

async function main() {
  const result = await ingestResidentIndex();
  const db = await connectMongo();
  const { upsertedCount, modifiedCount } = await persistResidentIndex(db, result.records);
  console.log(`REST ingestion: persisted ${upsertedCount} new, updated ${modifiedCount} existing in MongoDB`);
  await closeMongo();
}

main().catch((err) => {
  console.error('REST ingestion failed:', err);
  process.exitCode = 1;
});
