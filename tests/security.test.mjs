import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import {
  createSessionCookie,
  clearSessionCookie,
  readSession,
  verifyTeacherPassword
} from '../functions/_lib/auth.js';
import { onRequestPost as studentLogin } from '../functions/api/student-login.js';
import { onRequestPost as teacherLogin } from '../functions/api/auth/teacher-login.js';
import { onRequestGet as studentProfile } from '../functions/api/student-profile.js';
import { onRequestPost as logout } from '../functions/api/auth/logout.js';
import { onRequest as middleware } from '../functions/_middleware.js';
import { onRequestPost as manageAccessCodes } from '../functions/api/student-access-codes.js';

const secret = randomBytes(32).toString('base64url');
const env = { TOPMATH_SESSION_SECRET: secret };
const req = (path, options = {}) => new Request('https://topmath.example' + path, options);
const ctx = (request, next = async () => new Response('ok'), envOverride = env) => ({
  request, env: envOverride, data: {}, next
});
// Simule la table D1 de limitation et conserve le comportement des autres requêtes.
function rateLimitDb(studentRows = []) {
  const attempts = new Map();
  return {
    attempts,
    prepare(sql) {
      if (sql.startsWith('CREATE TABLE')) return { run: async () => ({ success: true }) };
      if (sql.startsWith('SELECT window_start, failures')) return {
        bind(scope, identifier) {
          return { first: async () => attempts.get(scope + ':' + identifier) || null };
        }
      };
      if (sql.startsWith('INSERT INTO auth_failed_attempts')) return {
        bind(scope, identifier, now, cutoff) {
          return { run: async () => {
            const key = scope + ':' + identifier;
            const previous = attempts.get(key);
            attempts.set(key, !previous || previous.window_start <= cutoff ?
              { window_start: now, failures: 1 } :
              { window_start: previous.window_start, failures: previous.failures + 1 });
          } };
        }
      };
      if (sql.startsWith('DELETE FROM auth_failed_attempts')) return {
        bind(scope, identifier) {
          return { run: async () => { attempts.delete(scope + ':' + identifier); } };
        }
      };
      return { bind() { return { all: async () => ({ results: studentRows }) }; } };
    }
  };
}

const makePasswordHash = (password, iterations = 100000) => {
  const salt = randomBytes(16);
  const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const b64 = value => value.toString('base64url');
  return 'pbkdf2-sha256$' + iterations + '$' + b64(salt) + '$' + b64(digest);
};

test('HMAC session validates and rejects tampering', async () => {
  const cookie = await createSessionCookie(env, 'student-123', 'student');
  assert.equal((await readSession(req('/api/student-profile', {
    headers: { Cookie: cookie.split(';')[0] }
  }), env)).role, 'student');

  const token = cookie.split(';')[0].split('=')[1];
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  payload.sub = 'student-999';
  const changed = Buffer.from(JSON.stringify(payload)).toString('base64url');
  assert.equal(await readSession(req('/api/student-profile', {
    headers: { Cookie: '__Host-topmath_session=' + changed + '.' + parts[1] }
  }), env), null);
});

test('PBKDF2 accepts a ten-character password at the Cloudflare-supported limit', async () => {
  const password = 'TopMath-26';
  const hash = makePasswordHash(password);
  assert.equal(password.length, 10);
  assert.equal(await verifyTeacherPassword(password, hash), true);
  assert.equal(await verifyTeacherPassword('wrong-password', hash), false);

  const unsupportedHash = makePasswordHash(password, 100001);
  assert.equal(await verifyTeacherPassword(password, unsupportedHash), false);
});

test('unauthenticated API access is rejected', async () => {
  assert.equal((await middleware(ctx(req('/api/roster')))).status, 401);
});

test('cross-origin API writes are rejected', async () => {
  const response = await middleware(ctx(req('/api/class-manage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: '{}'
  })));
  assert.equal(response.status, 403);
});

test('teacher sessions can access teacher APIs', async () => {
  const cookie = await createSessionCookie(env, 'teacher', 'teacher');
  assert.equal((await middleware(ctx(req('/api/roster', {
    headers: { Cookie: cookie.split(';')[0] }
  })))).status, 200);
});

test('student sessions cannot access teacher APIs', async () => {
  const cookie = await createSessionCookie(env, 'student-123', 'student');
  assert.equal((await middleware(ctx(req('/api/roster', {
    headers: { Cookie: cookie.split(';')[0] }
  })))).status, 403);
});

test('protected APIs fail closed without the session secret', async () => {
  assert.equal((await middleware(ctx(req('/api/roster'), async () => new Response('ok'), {}))).status, 503);
});

test('student login creates a signed session and rejects ambiguous access codes', async () => {
  const student = {
    id: 'stu-1', first_name: 'Élève', last_name: 'Test',
    class_name: 'Classe A', phase: 'Phase 1', school_year: '2026-2027'
  };
  const db = rateLimitDb([student]);
  const request = new Request('https://topmath.example/api/student-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'ABCD1234' })
  });
  const response = await studentLogin({ request, env: { ...env, DB: db } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Set-Cookie'), /HttpOnly/);

  const duplicateDb = rateLimitDb([student, student]);
  const duplicateRequest = new Request('https://topmath.example/api/student-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'ABCD1234' })
  });
  const duplicate = await studentLogin({ request: duplicateRequest, env: { ...env, DB: duplicateDb } });
  assert.equal(duplicate.status, 401);
});

test('teacher login verifies a ten-character PBKDF2 password before issuing a cookie', async () => {
  const password = 'TopMath-26';
  const hash = makePasswordHash(password);
  const envWithPassword = { ...env, DB: rateLimitDb(), TOPMATH_TEACHER_PASSWORD_HASH: hash };
  const makeRequest = value => new Request('https://topmath.example/api/auth/teacher-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: value })
  });

  const ok = await teacherLogin({ request: makeRequest(password), env: envWithPassword });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('Set-Cookie'), /HttpOnly/);

  const bad = await teacherLogin({ request: makeRequest('wrong-password'), env: envWithPassword });
  assert.equal(bad.status, 401);
});

test('student profile is derived from the signed student identity', async () => {
  const cookie = await createSessionCookie(env, 'stu-1', 'student');
  const student = {
    id: 'stu-1', first_name: 'Élève', last_name: 'Test',
    class_name: 'Classe A', phase: 'Phase 1', school_year: '2026-2027'
  };
  const db = {
    prepare() {
      return { bind(id) {
        assert.equal(id, 'stu-1');
        return { first: async () => student };
      } };
    }
  };
  const request = req('/api/student-profile', { headers: { Cookie: cookie.split(';')[0] } });
  const response = await studentProfile({ request, env: { ...env, DB: db } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).student.id, 'stu-1');
});

test('logout expires the session cookie', async () => {
  const response = await logout({});
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.match(clearSessionCookie(), /HttpOnly/);
});

test('teacher access-code API rotates a D1 student code', async () => {
  let savedCode = null;
  const db = {
    prepare(sql) {
      return {
        first: async () => ({ id: 'year-1', label: '2026-2027' }),
        bind(...args) {
          return {
            first: async () => {
              if (sql.includes('classes')) return { id: 'class-1', name: 'Classe A' };
              if (sql.includes('access_code')) return null;
              return { id: 'stu-1' };
            },
            run: async () => {
              savedCode = args[0];
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
  const request = new Request('https://topmath.example/api/student-access-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'rotate', class_id: 'class-1', student_id: 'stu-1' })
  });
  const response = await manageAccessCodes({ request, env: { ...env, DB: db } });
  assert.equal(response.status, 200);
  assert.match(savedCode, /^[A-Z0-9]{8}$/);
});

test('student login rejects short access codes before querying D1', async () => {
  let queried = false;
  const db = {
    prepare() {
      queried = true;
      return { bind() { return { all: async () => ({ results: [] }) }; } };
    }
  };
  const request = new Request('https://topmath.example/api/student-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '1234' })
  });
  const response = await studentLogin({ request, env: { ...env, DB: db } });
  assert.equal(response.status, 400);
  assert.equal(queried, false);
});

test('student repeated guesses are rejected after five failures on the same code', async () => {
  const db = rateLimitDb();
  const sharedEnv = { ...env, DB: db };
  const makeRequest = () => new Request('https://topmath.example/api/student-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.10' },
    body: JSON.stringify({ code: 'WRONG123' })
  });
  for (let i = 0; i < 5; i++) {
    assert.equal((await studentLogin({ request: makeRequest(), env: sharedEnv })).status, 401);
  }
  const blocked = await studentLogin({ request: makeRequest(), env: sharedEnv });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
});

test('teacher login is temporarily limited after eight wrong passwords', async () => {
  const sharedEnv = { ...env, DB: rateLimitDb(), TOPMATH_TEACHER_PASSWORD_HASH: makePasswordHash('TopMath-26') };
  const makeRequest = () => new Request('https://topmath.example/api/auth/teacher-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.11' },
    body: JSON.stringify({ password: 'wrong-password' })
  });
  for (let i = 0; i < 8; i++) {
    assert.equal((await teacherLogin({ request: makeRequest(), env: sharedEnv })).status, 401);
  }
  assert.equal((await teacherLogin({ request: makeRequest(), env: sharedEnv })).status, 429);
});

test('successful student login clears the attempted-code lockout counter', async () => {
  const student = { id: 'stu-1', first_name: 'Test', last_name: 'Student', class_name: 'A', phase: '1', school_year: '2026-2027' };
  const db = rateLimitDb();
  const sharedEnv = { ...env, DB: db };
  const request = () => new Request('https://topmath.example/api/student-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.12' },
    body: JSON.stringify({ code: 'ABCDE123' })
  });
  assert.equal((await studentLogin({ request: request(), env: sharedEnv })).status, 401);
  assert.equal(db.attempts.size, 2);
  const successfulEnv = { ...sharedEnv, DB: rateLimitDb([student]) };
  assert.equal((await studentLogin({ request: request(), env: successfulEnv })).status, 200);
  assert.equal([...successfulEnv.DB.attempts.keys()].some(key => key.startsWith('student_code:')), false);
});
