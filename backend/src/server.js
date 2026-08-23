import express from 'express';
import cors from 'cors';
import { connectMongo } from './db/mongo.js';
import { getUnifiedResident } from './api/unifiedResident.js';
import { searchResidents } from './api/search.js';
import { getReviewQueue, decideReviewItem } from './api/reviewQueue.js';
import { startCallLogging } from './health/callLog.js';
import { getHealthSummary } from './health/healthSummary.js';
import { findUser, verifyPassword } from './auth/users.js';
import { signToken } from './auth/jwt.js';
import { requireAuth, requireRole } from './auth/middleware.js';

const PORT = process.env.PORT || 3001;

function asyncRoute(handler) {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

async function main() {
  const db = await connectMongo();
  startCallLogging(db);
  const app = express();
  app.use(cors());
  app.use(express.json());

  // F12 — Authentication & Roles. No signup flow — a small fixed demo
  // roster (see auth/users.js) stands in for a real user store.
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const user = username ? findUser(username) : null;
    if (!user || !verifyPassword(user, password)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const token = signToken({ username: user.username, role: user.role });
    res.json({ token, username: user.username, role: user.role });
  });

  // The frontend only ever talks to this API — never :8081/:8082 directly.
  // Per the F12 permissions table, both roles can search and view records.
  app.get(
    '/api/residents',
    requireAuth,
    asyncRoute(async (req, res) => {
      const { q = '', page = '1' } = req.query;
      const result = await searchResidents(db, { q, page: parseInt(page, 10) || 1 });
      res.json(result);
    })
  );

  app.get(
    '/api/residents/:unifiedId',
    requireAuth,
    asyncRoute(async (req, res) => {
      const resident = await getUnifiedResident(db, req.params.unifiedId);
      if (!resident) {
        return res.status(404).json({ error: 'not_found', unifiedId: req.params.unifiedId });
      }
      res.json(resident);
    })
  );

  // F5 — Review Queue. Supervisor-only per the F12 permissions table.
  app.get(
    '/api/review-queue',
    requireAuth,
    requireRole('supervisor'),
    asyncRoute(async (req, res) => {
      const items = await getReviewQueue(db);
      res.json({ items });
    })
  );

  app.post(
    '/api/review-queue/decide',
    requireAuth,
    requireRole('supervisor'),
    asyncRoute(async (req, res) => {
      const { residentIndexId, benefitsRegisterId, decision, decidedBy, reason } = req.body || {};
      if (!residentIndexId || !benefitsRegisterId || !['confirm', 'reject'].includes(decision)) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'residentIndexId, benefitsRegisterId and decision ("confirm" | "reject") are required',
        });
      }
      const summary = await decideReviewItem(db, {
        residentIndexId,
        benefitsRegisterId,
        decision,
        decidedBy: req.user.username,
        reason,
      });
      res.json({ ok: true, summary });
    })
  );

  // F11 — Source Health Monitoring, driven by the call log every live
  // source client call reports into (see health/callEvents.js). Not listed
  // in the F12 permissions table, so open to any authenticated role.
  app.get(
    '/api/health',
    requireAuth,
    asyncRoute(async (req, res) => {
      const summary = await getHealthSummary(db);
      res.json({ sources: summary });
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
