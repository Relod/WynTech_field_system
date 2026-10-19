'use strict';

const {
  verifyPassword,
  hashPassword,
  issueSession,
  revokeSession,
  revokeAllUserSessions,
  setSessionCookie,
  clearSessionCookie,
  publicUser,
} = require('../auth');
const { ApiError, getClientIp } = require('../http');
const {
  requiredString,
  isPlainObject,
} = require('../validation');

const attempts = new Map();

function allowAttempt(key, { windowMs, max }) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= max) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);

  if (attempts.size > 5_000) {
    for (const [storedKey, timestamps] of attempts) {
      if (!timestamps.some((timestamp) => now - timestamp < windowMs)) {
        attempts.delete(storedKey);
      }
    }
  }
  return true;
}

function registerAuthRoutes(router) {
  const clientConfig = (config) => ({
    officialLaudoUrl: config.officialLaudoUrl || '',
    version: config.version,
  });

  router.post('/api/auth/login', async ({ req, res, body, db, config }) => {
    if (!isPlainObject(body)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.');
    }

    const email = requiredString(body.email, 'email', 150).toLowerCase();
    const senha = requiredString(body.senha, 'senha', 200);
    const key = `${getClientIp(req, config.trustProxy)}:${email}`;

    if (!allowAttempt(key, config.loginRateLimit)) {
      throw new ApiError(
        429,
        'TOO_MANY_ATTEMPTS',
        'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.'
      );
    }

    const user = db
      .prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1')
      .get(email);

    if (!user) {
      // Mantém o custo do scrypt mesmo quando o e-mail não existe.
      await hashPassword(senha);
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }

    const passwordOk = await verifyPassword(senha, user.senha_hash);
    if (!passwordOk) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }

    attempts.delete(key);
    const session = issueSession(db, user, req, config);
    setSessionCookie(res, session.token, config);

    return {
      data: {
        token: session.token,
        expira_em: session.expiraEm,
        usuario: publicUser(user),
        config: clientConfig(config),
      },
    };
  });

  router.post('/api/auth/logout', ({ res, db, session, config }) => {
    revokeSession(db, session.jti);
    clearSessionCookie(res, config);
    return { data: { ok: true } };
  });

  router.get('/api/auth/me', ({ user, config }) => {
    return { data: { usuario: publicUser(user), config: clientConfig(config) } };
  });

  router.post('/api/auth/alterar-senha', async ({ body, user, db, session }) => {
    if (!isPlainObject(body)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.');
    }

    const senhaAtual = requiredString(body.senha_atual, 'senha_atual', 200);
    const novaSenha = requiredString(body.nova_senha, 'nova_senha', 200);
    if (novaSenha.length < 8) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'A nova senha deve ter pelo menos 8 caracteres.',
        { field: 'nova_senha' }
      );
    }
    if (novaSenha === senhaAtual) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'A nova senha deve ser diferente da senha atual.',
        { field: 'nova_senha' }
      );
    }

    const current = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(user.id);
    const passwordOk = current && (await verifyPassword(senhaAtual, current.senha_hash));
    if (!passwordOk) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Senha atual inválida.');
    }

    const novaHash = await hashPassword(novaSenha);
    db.prepare(
      `UPDATE usuarios
       SET senha_hash = ?, atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    ).run(novaHash, user.id);

    revokeAllUserSessions(db, user.id, session.jti);
    return { data: { ok: true } };
  });
}

module.exports = { registerAuthRoutes };
