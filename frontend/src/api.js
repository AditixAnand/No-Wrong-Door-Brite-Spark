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

export { searchResidents, getResident };
