import { connectMongo, closeMongo } from '../db/mongo.js';
import { ingestBenefitsRegister, persistBenefitsRegister } from './xmlIngestion.js';

async function main() {
  const result = await ingestBenefitsRegister();

  if (!result.success) {
    console.error(`XML ingestion did not complete: ${result.reason}. MongoDB left unchanged.`);
    return;
  }

  const db = await connectMongo();
  const { upsertedCount, modifiedCount } = await persistBenefitsRegister(db, result.records);
  console.log(`XML ingestion: persisted ${upsertedCount} new, updated ${modifiedCount} existing in MongoDB`);
  await closeMongo();
}

main().catch((err) => {
  console.error('XML ingestion crashed unexpectedly:', err);
  process.exitCode = 1;
});
