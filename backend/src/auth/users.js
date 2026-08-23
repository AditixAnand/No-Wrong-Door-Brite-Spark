import bcrypt from 'bcryptjs';

// SPEC.md defines two roles and their permissions but no signup/user-
// management flow, so this is a small fixed demo roster standing in for a
// real user store. Passwords are still hashed rather than compared in
// plaintext — a five-minute difference worth making even in a demo.
const USERS = [
  { username: 'caseworker', passwordHash: bcrypt.hashSync('caseworker123', 8), role: 'caseworker' },
  { username: 'supervisor', passwordHash: bcrypt.hashSync('supervisor123', 8), role: 'supervisor' },
];

function findUser(username) {
  return USERS.find((u) => u.username === username) || null;
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.passwordHash);
}

export { findUser, verifyPassword };
