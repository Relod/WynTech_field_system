'use strict';

const http = require('node:http');
const { loadConfig } = require('../server/config');
const { openDatabase, runMigrations, closeDatabase } = require('../server/db');
const { seedDatabase } = require('../server/seed');
const { createApp } = require('../server/app');

async function createTestContext({ loginRateLimit } = {}) {
  const config = loadConfig({
    nodeEnv: 'test',
    dbPath: ':memory:',
    authSecret: 'test-secret-wyntech-campo-2026',
    cookieSecure: false,
    loginRateLimit: loginRateLimit || { windowMs: 60_000, max: 100 },
  });

  const db = openDatabase(':memory:');
  runMigrations(db, config.migrationsDir);
  await seedDatabase(db, config.seed);

  const server = http.createServer(createApp({ db, config }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(path, { method = 'GET', token, cookie, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      status: response.status,
      headers: response.headers,
      body: json,
      text,
    };
  }

  async function login(email, senha) {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: { email, senha },
    });
    if (result.status !== 200) {
      throw new Error(`Falha no login de teste (${result.status}): ${result.text}`);
    }
    return result;
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    closeDatabase(db);
  }

  return { config, db, baseUrl, request, login, close };
}

module.exports = { createTestContext };
