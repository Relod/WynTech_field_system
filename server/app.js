'use strict';

const { Router } = require('./router');
const {
  ApiError,
  sendJson,
  sendError,
  readJson,
  applySecurityHeaders,
  applyCors,
  serveStatic,
} = require('./http');
const { authenticate } = require('./auth');
const { registerAuthRoutes } = require('./routes/auth');
const { registerChamadoRoutes } = require('./routes/chamados');
const { registerComarcaRoutes } = require('./routes/comarcas');
const { registerDashboardRoutes } = require('./routes/dashboard');

const PUBLIC_ROUTES = new Set(['GET /api/health', 'POST /api/auth/login']);
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

function createApp({ db, config }) {
  const router = new Router();

  router.get('/api/health', () => {
    db.prepare('SELECT 1 AS ok').get();
    return {
      data: {
        status: 'ok',
        version: config.version,
        database: 'ok',
        ambiente: config.env,
      },
    };
  });

  registerAuthRoutes(router);
  registerChamadoRoutes(router);
  registerComarcaRoutes(router);
  registerDashboardRoutes(router);

  return async function requestHandler(req, res) {
    applySecurityHeaders(res, config);

    try {
      const url = new URL(req.url, 'http://localhost');
      let pathname = url.pathname;
      if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');

      if (pathname === '/api' || pathname.startsWith('/api/')) {
        applyCors(req, res, config);

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const match = router.match(req.method, pathname);
        if (!match) {
          sendError(res, 404, 'NOT_FOUND', 'Endpoint não encontrado.');
          return;
        }

        const publicKey = `${req.method} ${pathname}`;
        let user = null;
        let session = null;
        if (!PUBLIC_ROUTES.has(publicKey)) {
          const auth = authenticate(db, req, config);
          user = auth.user;
          session = auth.session;
        }

        let body = {};
        if (BODY_METHODS.has(req.method)) {
          body = await readJson(req, config.maxBodyBytes);
        }

        const result = await match.handler({
          req,
          res,
          params: match.params,
          query: Object.fromEntries(url.searchParams),
          body,
          user,
          session,
          db,
          config,
        });

        if (res.writableEnded) return;

        const status = result?.status || 200;
        if (status === 204) {
          sendJson(res, 204);
          return;
        }

        const payload = { success: true };
        if (result && Object.prototype.hasOwnProperty.call(result, 'data')) {
          payload.data = result.data;
        } else {
          payload.data = result ?? null;
        }
        if (result?.meta) payload.meta = result.meta;

        sendJson(res, status, payload);
        return;
      }

      serveStatic(req, res, config.publicDir);
    } catch (error) {
      if (res.writableEnded) return;
      if (error instanceof ApiError) {
        sendError(res, error.status, error.code, error.message, error.details);
        return;
      }

      console.error('[wyntech] erro não tratado:', error);
      sendError(res, 500, 'INTERNAL_ERROR', 'Erro interno do servidor.');
    }
  };
}

module.exports = { createApp };
