'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const {
  ApiError,
  parseCookies,
  serializeCookie,
  getClientIp,
} = require('./http');

const scryptAsync = promisify(crypto.scrypt);
const SCRYPT = {
  N: 16_384,
  r: 8,
  p: 1,
  keylen: 64,
  maxmem: 64 * 1024 * 1024,
};

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keylen, SCRYPT);
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltEncoded, hashEncoded] = parts;
  try {
    const salt = Buffer.from(saltEncoded, 'base64url');
    const expected = Buffer.from(hashEncoded, 'base64url');
    const actual = await scryptAsync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signToken(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const encodedPayload = encodeJson(body);
  const data = `${header}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token, secret) {
  if (typeof token !== 'string') {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Autenticação necessária.');
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Sessão inválida.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const actualBuffer = Buffer.from(encodedSignature, 'base64url');
  const expectedBuffer = Buffer.from(expected, 'base64url');

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Sessão inválida.');
  }

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'Sessão inválida.');
  }

  if (header.alg !== 'HS256' || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, 'EXPIRED_TOKEN', 'Sessão expirada. Faça login novamente.');
  }

  return payload;
}

function extractToken(req, config) {
  const authorization = String(req.headers.authorization || '');
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[config.cookieName] || null;
}

function issueSession(db, user, req, config) {
  const jti = crypto.randomUUID();
  const expiraEm = new Date(Date.now() + config.tokenTtlSeconds * 1000).toISOString();
  const ip = getClientIp(req, config.trustProxy).slice(0, 64);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 255);

  db.prepare(
    `INSERT INTO sessoes (usuario_id, jti, expira_em, ip, user_agent)
     VALUES (?, ?, ?, ?, ?)`
  ).run(user.id, jti, expiraEm, ip, userAgent);

  const token = signToken(
    { sub: user.id, papel: user.papel, jti },
    config.authSecret,
    config.tokenTtlSeconds
  );

  return { token, jti, expiraEm };
}

function authenticate(db, req, config) {
  const token = extractToken(req, config);
  if (!token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Autenticação necessária.');
  }

  const payload = verifyToken(token, config.authSecret);
  const row = db
    .prepare(
      `SELECT s.jti, s.expira_em, s.revogado_em, u.*
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.jti = ?`
    )
    .get(payload.jti);

  if (
    !row ||
    row.revogado_em ||
    new Date(row.expira_em).getTime() <= Date.now() ||
    row.ativo !== 1 ||
    Number(payload.sub) !== row.id
  ) {
    throw new ApiError(401, 'INVALID_SESSION', 'Sessão inválida ou expirada.');
  }

  return {
    user: row,
    session: { jti: row.jti, expiraEm: row.expira_em },
  };
}

function revokeSession(db, jti) {
  if (!jti) return false;
  const result = db
    .prepare(
      `UPDATE sessoes
       SET revogado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE jti = ? AND revogado_em IS NULL`
    )
    .run(jti);
  return result.changes > 0;
}

function revokeAllUserSessions(db, userId, exceptJti = null) {
  if (exceptJti) {
    return db
      .prepare(
        `UPDATE sessoes
         SET revogado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE usuario_id = ? AND jti <> ? AND revogado_em IS NULL`
      )
      .run(userId, exceptJti).changes;
  }
  return db
    .prepare(
      `UPDATE sessoes
       SET revogado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE usuario_id = ? AND revogado_em IS NULL`
    )
    .run(userId).changes;
}

function setSessionCookie(res, token, config) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(config.cookieName, token, {
      maxAge: config.tokenTtlSeconds,
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'Lax',
      path: '/',
    })
  );
}

function clearSessionCookie(res, config) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(config.cookieName, '', {
      maxAge: 0,
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'Lax',
      path: '/',
    })
  );
}

function publicUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    matricula: user.matricula,
    cargo: user.cargo,
    papel: user.papel,
    criado_em: user.criado_em,
  };
}

function requireAdmin(user) {
  if (user.papel !== 'ADMIN') {
    throw new ApiError(403, 'FORBIDDEN', 'Ação restrita a administradores.');
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  extractToken,
  issueSession,
  authenticate,
  revokeSession,
  revokeAllUserSessions,
  setSessionCookie,
  clearSessionCookie,
  publicUser,
  requireAdmin,
};
