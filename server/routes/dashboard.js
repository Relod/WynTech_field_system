'use strict';

function registerDashboardRoutes(router) {
  router.get('/api/dashboard', ({ db, user }) => {
    const where = ['c.excluido_em IS NULL'];
    const params = [];
    if (user.papel !== 'ADMIN') {
      where.push('c.usuario_id = ?');
      params.push(user.id);
    }
    const whereSql = where.join(' AND ');

    const resumo = db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN c.status = 'ABERTO' THEN 1 ELSE 0 END), 0) AS abertos,
           COALESCE(SUM(CASE WHEN c.status = 'EM_ANDAMENTO' THEN 1 ELSE 0 END), 0) AS em_andamento,
           COALESCE(SUM(CASE WHEN c.status = 'FINALIZADO' THEN 1 ELSE 0 END), 0) AS finalizados,
           COALESCE(SUM(CASE WHEN c.data_atendimento = date('now', 'localtime') THEN 1 ELSE 0 END), 0) AS hoje
         FROM chamados c
         WHERE ${whereSql}`
      )
      .get(...params);

    const recentes = db
      .prepare(
        `SELECT c.id, c.numero_os, c.tipo, c.status, c.data_atendimento,
                c.setor, c.atualizado_em, co.nome AS comarca_nome
         FROM chamados c
         JOIN comarcas co ON co.id = c.comarca_id
         WHERE ${whereSql}
         ORDER BY c.atualizado_em DESC, c.id DESC
         LIMIT 5`
      )
      .all(...params);

    return { data: { resumo, recentes } };
  });
}

module.exports = { registerDashboardRoutes };
