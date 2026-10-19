'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../server/config');

test('configuração valida URL oficial apenas no domínio do Apps Script', () => {
  const valid = loadConfig({
    nodeEnv: 'production',
    authSecret: 'a'.repeat(64),
    officialLaudoUrl: 'https://script.google.com/macros/s/abc123/exec',
  });
  assert.equal(
    valid.officialLaudoUrl,
    'https://script.google.com/macros/s/abc123/exec'
  );

  assert.throws(
    () =>
      loadConfig({
        nodeEnv: 'production',
        authSecret: 'a'.repeat(64),
        officialLaudoUrl: 'https://evil.example/macros/s/abc123/exec',
      }),
    /OFFICIAL_LAUDO_URL/
  );

  assert.throws(
    () =>
      loadConfig({
        nodeEnv: 'production',
        authSecret: 'a'.repeat(64),
        officialLaudoUrl: 'https://script.google.com/outro/caminho',
      }),
    /OFFICIAL_LAUDO_URL/
  );

  assert.throws(
    () =>
      loadConfig({
        nodeEnv: 'production',
        authSecret: 'a'.repeat(64),
        officialLaudoUrl: 'https://script.google.com:444/macros/s/abc123/exec',
      }),
    /OFFICIAL_LAUDO_URL/
  );
});

test('configuração de produção exige segredo forte e porta válida', () => {
  assert.throws(
    () => loadConfig({ nodeEnv: 'production', authSecret: 'curto' }),
    /AUTH_SECRET/
  );
  assert.throws(
    () =>
      loadConfig({
        nodeEnv: 'development',
        authSecret: 'a'.repeat(32),
        port: 70_000,
      }),
    /PORT/
  );
  assert.throws(
    () =>
      loadConfig({
        nodeEnv: 'development',
        authSecret: 'a'.repeat(32),
        tokenTtlSeconds: 10,
      }),
    /TOKEN_TTL_SECONDS/
  );
  assert.throws(
    () =>
      loadConfig({
        nodeEnv: 'development',
        authSecret: 'a'.repeat(32),
        loginRateLimit: { max: 0 },
      }),
    /LOGIN_RATE_LIMIT_MAX/
  );
});
