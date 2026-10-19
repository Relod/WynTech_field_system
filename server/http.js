'use strict';

const fs = require('node:fs');
const path = require('node:path');

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function sendJson(res, status, payload, extraHeaders = {}) {
  if (res.writableEnded) return;
  if (status === 204) {
    res.writeHead(204, { 'Cache-Control': 'no-store', ...extraHeaders });
    res.end();
    return;
  }
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function sendError(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  sendJson(res, status, { success: false, error: message, code, details });
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let total = 0;
    let finished = false;
    const chunks = [];

    const fail = (error) => {
      if (finished) return;
      finished = true;
      reject(error);
      req.resume();
    };

    const declared = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(declared) && declared > maxBytes) {
      fail(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição muito grande.'));
      return;
    }

    req.on('data', (chunk) => {
      if (finished) return;
      total += chunk.length;
      if (total > maxBytes) {
        fail(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição muito grande.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (finished) return;
      finished = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', fail);
    req.on('aborted', () => {
      fail(new ApiError(400, 'REQUEST_ABORTED', 'Requisição interrompida.'));
    });
  });
}

async function readJson(req, maxBytes) {
  const raw = await readBody(req, maxBytes);
  if (raw.length === 0) return {};

  const contentType = String(req.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (contentType && contentType !== 'application/json' && !contentType.endsWith('+json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envie o corpo como application/json.');
  }

  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    return parsed === null ? {} : parsed;
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'JSON inválido.');
  }
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      cookies[key] = part.slice(index + 1).trim();
    }
  }
  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  return parts.join('; ');
}

function getClientIp(req, trustProxy = false) {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function applySecurityHeaders(res, config) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "font-src 'self'",
      "style-src 'self'",
      "script-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  if (config?.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function applyCors(req, res, config) {
  const origin = req.headers.origin;
  if (!config.corsOrigin || !origin || origin !== config.corsOrigin) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
  return true;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

function serveStatic(req, res, publicDir) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Método não permitido.');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Caminho inválido.');
    return;
  }

  if (pathname.includes('\0')) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Caminho inválido.');
    return;
  }

  if (pathname === '/' || pathname === '') pathname = '/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';

  const segments = pathname.split('/');
  if (segments.some((segment) => segment.startsWith('.'))) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado.');
    return;
  }

  const candidate = path.resolve(publicDir, `.${pathname}`);
  if (candidate !== publicDir && !candidate.startsWith(`${publicDir}${path.sep}`)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado.');
    return;
  }

  let filePath = candidate;
  try {
    if (fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) throw new Error('not a file');
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
      'Last-Modified': stat.mtime.toUTCString(),
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.writableEnded) res.end();
    });
    stream.pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado.');
  }
}

module.exports = {
  ApiError,
  sendJson,
  sendError,
  readBody,
  readJson,
  parseCookies,
  serializeCookie,
  getClientIp,
  applySecurityHeaders,
  applyCors,
  serveStatic,
};
