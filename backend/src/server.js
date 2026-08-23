import express from 'express';
import cors from 'cors';
import { connectMongo } from './db/mongo.js';
import { getUnifiedResident } from './api/unifiedResident.js';
import { searchResidents } from './api/search.js';

const PORT = process.env.PORT || 3001;

function asyncRoute(handler) {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

async function main() {
  const db = await connectMongo();
  const app = express();
  app.use(cors());

  // The frontend only ever talks to this API — never :8081/:8082 directly.
  app.get(
    '/api/residents',
    asyncRoute(async (req, res) => {
      const { q = '', page = '1' } = req.query;
      const result = await searchResidents(db, { q, page: parseInt(page, 10) || 1 });
      res.json(result);
    })
  );

  app.get(
    '/api/residents/:unifiedId',
    asyncRoute(async (req, res) => {
      const resident = await getUnifiedResident(db, req.params.unifiedId);
      if (!resident) {
        return res.status(404).json({ error: 'not_found', unifiedId: req.params.unifiedId });
      }
      res.json(resident);
    })
  );

  // Even an unexpected bug in our own code should not crash the process or
  // leak a stack trace to the client.
  app.use((err, req, res, next) => {
    console.error('Unified API error:', err);
    res.status(500).json({ error: 'internal_error' });
  });

  app.listen(PORT, () => {
    console.log(`Unified API listening on http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start Unified API:', err);
  process.exit(1);
});
