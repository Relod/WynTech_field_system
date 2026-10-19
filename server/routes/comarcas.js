'use strict';

function registerComarcaRoutes(router) {
  router.get('/api/comarcas', ({ db, query }) => {
    const includeInactive = query.todas === '1';
    const rows = db
      .prepare(
        `SELECT id, nome, cidade, endereco, ativa, criado_em
         FROM comarcas
         ${includeInactive ? '' : 'WHERE ativa = 1'}
         ORDER BY nome COLLATE NOCASE`
      )
      .all();
    return { data: rows };
  });
}

module.exports = { registerComarcaRoutes };
