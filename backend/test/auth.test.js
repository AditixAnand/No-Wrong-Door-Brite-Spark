import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findUser, verifyPassword } from '../src/auth/users.js';
import { signToken, verifyToken } from '../src/auth/jwt.js';
import { requireAuth, requireRole } from '../src/auth/middleware.js';

test('findUser returns the known demo users with their role', () => {
  assert.equal(findUser('caseworker').role, 'caseworker');
  assert.equal(findUser('supervisor').role, 'supervisor');
  assert.equal(findUser('nobody'), null);
});

test('verifyPassword accepts the correct password and rejects a wrong one', () => {
  const user = findUser('caseworker');
  assert.equal(verifyPassword(user, 'caseworker123'), true);
  assert.equal(verifyPassword(user, 'wrong-password'), false);
});

test('signToken/verifyToken round-trip the payload', () => {
  const token = signToken({ username: 'supervisor', role: 'supervisor' });
  const decoded = verifyToken(token);
  assert.equal(decoded.username, 'supervisor');
  assert.equal(decoded.role, 'supervisor');
});

test('verifyToken rejects a tampered token', () => {
  const token = signToken({ username: 'caseworker', role: 'caseworker' });
  const tampered = token.slice(0, -2) + 'xx';
  assert.throws(() => verifyToken(tampered));
});

function mockReqRes(headers = {}) {
  const req = { headers };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return { req, res };
}

test('requireAuth rejects a request with no bearer token', () => {
  const { req, res } = mockReqRes({});
  let nextCalled = false;
  requireAuth(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireAuth attaches req.user and calls next for a valid token', () => {
  const token = signToken({ username: 'caseworker', role: 'caseworker' });
  const { req, res } = mockReqRes({ authorization: `Bearer ${token}` });
  let nextCalled = false;
  requireAuth(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.user.role, 'caseworker');
});

test('requireRole blocks a caseworker from a supervisor-only route', () => {
  const { req, res } = mockReqRes();
  req.user = { username: 'caseworker', role: 'caseworker' };
  let nextCalled = false;
  requireRole('supervisor')(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('requireRole allows a supervisor through', () => {
  const { req, res } = mockReqRes();
  req.user = { username: 'supervisor', role: 'supervisor' };
  let nextCalled = false;
  requireRole('supervisor')(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});
