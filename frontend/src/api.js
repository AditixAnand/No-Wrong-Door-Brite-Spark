// The only place the frontend talks to the network — always our own Unified
// API (proxied to :3001 in dev), never the source services on :8081/:8082.

async function searchResidents(q, page = 1) {
  const params = new URLSearchParams({ q, page: String(page) });
  const res = await fetch(`/api/residents?${params}`);
  if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
  return res.json();
}

async function getResident(unifiedId) {
  const res = await fetch(`/api/residents/${encodeURIComponent(unifiedId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lookup failed: HTTP ${res.status}`);
  return res.json();
}

async function getReviewQueue() {
  const res = await fetch('/api/review-queue');
  if (!res.ok) throw new Error(`Review queue fetch failed: HTTP ${res.status}`);
  return res.json();
}

async function decideReviewItem({ residentIndexId, benefitsRegisterId, decision, decidedBy, reason }) {
  const res = await fetch('/api/review-queue/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ residentIndexId, benefitsRegisterId, decision, decidedBy, reason }),
  });
  if (!res.ok) throw new Error(`Decision failed: HTTP ${res.status}`);
  return res.json();
}

async function getHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`Health fetch failed: HTTP ${res.status}`);
  return res.json();
}

export { searchResidents, getResident, getReviewQueue, decideReviewItem, getHealth };
