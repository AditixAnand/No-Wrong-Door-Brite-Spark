// Token storage and the login call. Kept separate from api.js so api.js can
// import getToken() without a circular dependency.

const STORAGE_KEY = 'nwd_auth';

function getSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getToken() {
  return getSession()?.token || null;
}

function getRole() {
  return getSession()?.role || null;
}

async function login(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error('Invalid username or password');
  }
  const session = await res.json();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export { getSession, getToken, getRole, login, logout };
