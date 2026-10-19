'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestContext } = require('./helpers');

test('Frontend estático, cabeçalhos e erros de caminho', async () => {
  const ctx = await createTestContext();

  try {
    const home = await ctx.request('/');
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.match(home.text, /Wyntech Campo TJMG/);
    assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
    assert.match(home.headers.get('content-security-policy'), /form-action 'self'/);
    assert.doesNotMatch(home.headers.get('content-security-policy'), /unsafe-inline/);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(home.headers.get('x-frame-options'), 'DENY');
    assert.equal(home.headers.get('cache-control'), 'no-cache');

    const script = await ctx.request('/app.js');
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /javascript/);
    assert.match(script.text, /Wyntech Campo TJMG/);
    assert.doesNotMatch(script.text, /script\.google\.com\/macros\/s\//);

    const style = await ctx.request('/mvp.css');
    assert.equal(style.status, 200);
    assert.match(style.headers.get('content-type'), /text\/css/);

    const missing = await ctx.request('/arquivo-inexistente');
    assert.equal(missing.status, 404);

    const malformed = await ctx.request('/api/chamados/%E0%A4%A');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.code, 'INVALID_PATH');
  } finally {
    await ctx.close();
  }
});
