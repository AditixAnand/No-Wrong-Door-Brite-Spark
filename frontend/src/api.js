// The only place the frontend talks to the network — always our own Unified
// API (proxied to :3001 in dev), never the source services on :8081/:8082.
import { getToken, logout } from './auth.js';

class AuthError extends Error {}

async function authedFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new AuthError('Session expired — please log in again.');
  }
  return res;
}

async function searchResidents(q, page = 1) {
  const params = new URLSearchParams({ q, page: String(page) });
  const res = await authedFetch(`/api/residents?${params}`);
  if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
  return res.json();
}

async function getResident(unifiedId) {
  const res = await authedFetch(`/api/residents/${encodeURIComponent(unifiedId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lookup failed: HTTP ${res.status}`);
  return res.json();
}

async function getReviewQueue() {
  const res = await authedFetch('/api/review-queue');
  if (!res.ok) throw new Error(`Review queue fetch failed: HTTP ${res.status}`);
  return res.json();
}

async function decideReviewItem({ residentIndexId, benefitsRegisterId, decision, reason }) {
  const res = await authedFetch('/api/review-queue/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ residentIndexId, benefitsRegisterId, decision, reason }),
  });
  if (!res.ok) throw new Error(`Decision failed: HTTP ${res.status}`);
  return res.json();
}

async function getHealth() {
  const res = await authedFetch('/api/health');
  if (!res.ok) throw new Error(`Health fetch failed: HTTP ${res.status}`);
  return res.json();
}

async function getAuditLog() {
  const res = await authedFetch('/api/audit-log');
  if (!res.ok) throw new Error(`Audit log fetch failed: HTTP ${res.status}`);
  return res.json();
}

async function getReliability() {
  const res = await authedFetch('/api/reliability');
  if (!res.ok) throw new Error(`Reliability fetch failed: HTTP ${res.status}`);
  return res.json();
}

export {
  searchResidents,
  getResident,
  getReviewQueue,
  decideReviewItem,
  getHealth,
  getAuditLog,
  getReliability,
  AuthError,
};
