'use strict';

const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const pkg = require(path.join(ROOT_DIR, 'package.json'));

function asBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

function resolveDatabasePath(rawPath) {
  if (rawPath === ':memory:') return rawPath;
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(ROOT_DIR, rawPath);
}

function positiveInteger(value, field, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = value === undefined || value === null || value === '' ? fallback : value;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} deve ser um número inteiro entre ${min} e ${max}.`);
  }
  return parsed;
}

function resolveOfficialLaudoUrl(rawUrl) {
  if (!rawUrl) return '';
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('OFFICIAL_LAUDO_URL deve ser uma URL válida.');
  }
  const isGoogleScript = parsed.protocol === 'https:' && parsed.hostname === 'script.google.com';
  const isExecutavel = /^\/macros\/s\/[^/]+\/exec\/?$/.test(parsed.pathname);
  if (
    !isGoogleScript ||
    !isExecutavel ||
    parsed.port ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      'OFFICIAL_LAUDO_URL deve apontar para https://script.google.com/macros/s/.../exec.'
    );
  }
  return parsed.toString();
}

/**
 * Carrega a configuração do servidor. Os testes passam overrides para usar
 * banco em memória e segredo determinístico sem tocar no .env.
 */
function loadConfig(overrides = {}) {
  const env = process.env;
  const nodeEnv = overrides.nodeEnv || env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const authSecret =
    overrides.authSecret ||
    env.AUTH_SECRET ||
    (isProduction ? '' : 'dev-only-wyntech-secret-change-me');

  if (!authSecret) {
    throw new Error(
      'AUTH_SECRET é obrigatório em produção. Defina uma chave aleatória no ambiente.'
    );
  }
  if (isProduction && authSecret.length < 32) {
    throw new Error('AUTH_SECRET deve ter pelo menos 32 caracteres em produção.');
  }

  const dbPath = resolveDatabasePath(
    overrides.dbPath || env.DB_PATH || './data/wyntech.sqlite'
  );
  const port = positiveInteger(overrides.port ?? env.PORT, 'PORT', 3000, {
    min: 1,
    max: 65_535,
  });
  const tokenTtlSeconds = positiveInteger(
    overrides.tokenTtlSeconds ?? env.TOKEN_TTL_SECONDS,
    'TOKEN_TTL_SECONDS',
    43_200,
    { min: 60, max: 31_536_000 }
  );
  const maxBodyBytes = positiveInteger(
    env.MAX_BODY_BYTES,
    'MAX_BODY_BYTES',
    1_000_000,
    { min: 1_024, max: 10_000_000 }
  );
  const loginRateLimitMax = positiveInteger(
    overrides.loginRateLimit?.max ?? env.LOGIN_RATE_LIMIT_MAX,
    'LOGIN_RATE_LIMIT_MAX',
    5,
    { min: 1, max: 10_000 }
  );

  return {
    rootDir: ROOT_DIR,
    version: pkg.version,
    env: nodeEnv,
    isProduction,
    host: overrides.host || env.HOST || '127.0.0.1',
    port,
    dbPath,
    authSecret,
    tokenTtlSeconds,
    cookieName: env.COOKIE_NAME || 'wyntech_session',
    cookieSecure:
      overrides.cookieSecure !== undefined
        ? Boolean(overrides.cookieSecure)
        : asBoolean(env.COOKIE_SECURE, isProduction),
    publicDir: path.join(ROOT_DIR, 'public'),
    migrationsDir: path.join(ROOT_DIR, 'server', 'migrations'),
    officialLaudoUrl: resolveOfficialLaudoUrl(
      overrides.officialLaudoUrl ?? env.OFFICIAL_LAUDO_URL ?? ''
    ),
    maxBodyBytes,
    trustProxy: asBoolean(env.TRUST_PROXY, false),
    corsOrigin: env.CORS_ORIGIN || '',
    loginRateLimit: {
      windowMs: overrides.loginRateLimit?.windowMs ?? 15 * 60 * 1000,
      max: loginRateLimitMax,
    },
    seed: {
      adminEmail: env.SEED_ADMIN_EMAIL || 'admin@wyntech.local',
      adminPassword: env.SEED_ADMIN_PASSWORD || 'Wyntech@2026',
      tecnicoEmail: env.SEED_TECNICO_EMAIL || 'tecnico@wyntech.local',
      tecnicoPassword: env.SEED_TECNICO_PASSWORD || 'Wyntech@2026',
    },
  };
}

module.exports = { loadConfig, ROOT_DIR };
