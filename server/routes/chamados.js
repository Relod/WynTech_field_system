'use strict';

const { ApiError } = require('../http');
const {
  requiredString,
  optionalString,
  requiredInt,
  optionalInt,
  enumValue,
  optionalEnum,
  dateValue,
  optionalDate,
  objectValue,
  isPlainObject,
  parsePagination,
  escapeLike,
} = require('../validation');

const TIPOS = ['IN', 'TR', 'REQ'];
const STATUS = ['ABERTO', 'EM_ANDAMENTO', 'FINALIZADO'];
const ACOES = ['VERIFICACAO', 'RETIRADA', 'INSTALACAO', 'TROCA'];
const MOVIMENTACOES = ['MANUTENCAO', 'DEVOLUCAO'];
const DOCUMENTOS = ['LAUDO', 'LAUDO_ROLLOUT', 'ROMANEIO'];
const LOCAL_ENTREGA_PADRAO = 'Sala Polo Divinópolis';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function nowIso() {
  return new Date().toISOString();
}

function ensureObject(body) {
  if (!isPlainObject(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.');
  }
  return body;
}

function assertComarca(db, comarcaId) {
  const comarca = db
    .prepare('SELECT id, nome FROM comarcas WHERE id = ? AND ativa = 1')
    .get(comarcaId);
  if (!comarca) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Comarca inválida ou inativa.', {
      field: 'comarca_id',
    });
  }
  return comarca;
}

function assertUsuario(db, usuarioId) {
  const usuario = db
    .prepare('SELECT id FROM usuarios WHERE id = ? AND ativo = 1')
    .get(usuarioId);
  if (!usuario) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Técnico inválido ou inativo.', {
      field: 'usuario_id',
    });
  }
  return usuario;
}

function chamadoBaseSql() {
  return `
    SELECT c.*, co.nome AS comarca_nome, u.nome AS usuario_nome
    FROM chamados c
    JOIN comarcas co ON co.id = c.comarca_id
    JOIN usuarios u ON u.id = c.usuario_id
  `;
}

function getChamadoBase(db, id) {
  return db.prepare(`${chamadoBaseSql()} WHERE c.id = ?`).get(id);
}

function getChamadoAcessivel(db, id, user) {
  const chamado = getChamadoBase(db, id);
  if (
    !chamado ||
    chamado.excluido_em ||
    (user.papel !== 'ADMIN' && chamado.usuario_id !== user.id)
  ) {
    throw new ApiError(404, 'NOT_FOUND', 'Chamado não encontrado.');
  }
  return chamado;
}

function publicDocumento(row) {
  let dados = {};
  try {
    dados = JSON.parse(row.dados_json);
  } catch {
    dados = {};
  }
  return {
    id: row.id,
    chamado_id: row.chamado_id,
    tipo_doc: row.tipo_doc,
    gerado_em: row.gerado_em,
    dados,
  };
}

function listDocumentos(db, chamadoId) {
  return db
    .prepare(
      `SELECT id, chamado_id, tipo_doc, gerado_em, dados_json
       FROM documentos_gerados
       WHERE chamado_id = ?
       ORDER BY gerado_em DESC, id DESC`
    )
    .all(chamadoId)
    .map(publicDocumento);
}

function getChamadoCompleto(db, id, user) {
  const chamado = getChamadoAcessivel(db, id, user);
  const equipamentos = db
    .prepare('SELECT * FROM equipamentos WHERE chamado_id = ? ORDER BY id')
    .all(id);

  for (const equipamento of equipamentos) {
    equipamento.checklist = db
      .prepare(
        `SELECT id, item, avaliacao_wyntech, avaliacao_tjmg, observacao
         FROM checklist_verificacao WHERE equipamento_id = ? ORDER BY id`
      )
      .all(equipamento.id);
    equipamento.acessorios = db
      .prepare(
        `SELECT id, tipo, presente, descricao_outros
         FROM acessorios WHERE equipamento_id = ? ORDER BY id`
      )
      .all(equipamento.id);
  }

  const trocas = db
    .prepare(
      `SELECT t.*, er.patrimonio AS retirado_patrimonio,
              er.serial AS retirado_serial, er.modelo AS retirado_modelo,
              ei.patrimonio AS instalado_patrimonio,
              ei.serial AS instalado_serial, ei.modelo AS instalado_modelo
       FROM trocas t
       LEFT JOIN equipamentos er ON er.id = t.equip_retirado_id
       LEFT JOIN equipamentos ei ON ei.id = t.equip_instalado_id
       WHERE t.chamado_id = ?
       ORDER BY t.id DESC`
    )
    .all(id);

  return {
    ...chamado,
    equipamentos,
    trocas,
    documentos: listDocumentos(db, id),
  };
}

function getEquipamentoAcessivel(db, equipamentoId, user) {
  const equipamento = db
    .prepare(
      `SELECT e.*, c.usuario_id, c.excluido_em AS chamado_excluido_em
       FROM equipamentos e
       JOIN chamados c ON c.id = e.chamado_id
       WHERE e.id = ?`
    )
    .get(equipamentoId);

  if (
    !equipamento ||
    equipamento.chamado_excluido_em ||
    (user.papel !== 'ADMIN' && equipamento.usuario_id !== user.id)
  ) {
    throw new ApiError(404, 'NOT_FOUND', 'Equipamento não encontrado.');
  }
  return equipamento;
}

function assertEquipamentoDoChamado(db, equipamentoId, chamadoId, field) {
  const equipamento = db
    .prepare('SELECT id FROM equipamentos WHERE id = ? AND chamado_id = ?')
    .get(equipamentoId, chamadoId);
  if (!equipamento) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Equipamento não pertence ao chamado.', {
      field,
    });
  }
  return equipamento;
}

function registerChamadoRoutes(router) {
  router.get('/api/chamados', ({ db, query, user }) => {
    const { page, limit, offset } = parsePagination(query);
    const where = ['c.excluido_em IS NULL'];
    const params = [];

    if (user.papel !== 'ADMIN') {
      where.push('c.usuario_id = ?');
      params.push(user.id);
    }

    const tipo = optionalEnum(query.tipo, TIPOS, 'tipo');
    if (tipo) {
      where.push('c.tipo = ?');
      params.push(tipo);
    }

    const status = optionalEnum(query.status, STATUS, 'status');
    if (status) {
      where.push('c.status = ?');
      params.push(status);
    }

    const comarcaId = optionalInt(query.comarca_id, 'comarca_id');
    if (comarcaId) {
      where.push('c.comarca_id = ?');
      params.push(comarcaId);
    }

    const dataDe = optionalDate(query.data_de, 'data_de');
    if (dataDe) {
      where.push('c.data_atendimento >= ?');
      params.push(dataDe);
    }

    const dataAte = optionalDate(query.data_ate, 'data_ate');
    if (dataAte) {
      where.push('c.data_atendimento <= ?');
      params.push(dataAte);
    }

    const busca = optionalString(query.busca, 'busca', 100);
    if (busca) {
      const term = `%${escapeLike(busca)}%`;
      where.push(
        `(c.numero_os LIKE ? ESCAPE '\\' OR c.setor LIKE ? ESCAPE '\\' ` +
          `OR c.pessoa_contato LIKE ? ESCAPE '\\' OR c.defeito_relatado LIKE ? ESCAPE '\\')`
      );
      params.push(term, term, term, term);
    }

    const whereSql = where.join(' AND ');
    const total = db
      .prepare(`SELECT COUNT(*) AS total FROM chamados c WHERE ${whereSql}`)
      .get(...params).total;

    const rows = db
      .prepare(
        `SELECT c.*, co.nome AS comarca_nome, u.nome AS usuario_nome
         FROM chamados c
         JOIN comarcas co ON co.id = c.comarca_id
         JOIN usuarios u ON u.id = c.usuario_id
         WHERE ${whereSql}
         ORDER BY c.data_atendimento DESC, c.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return { data: rows, meta: { page, limit, total } };
  });

  router.post('/api/chamados', ({ body, db, user }) => {
    ensureObject(body);

    const usuarioId =
      user.papel === 'ADMIN' && hasOwn(body, 'usuario_id')
        ? requiredInt(body.usuario_id, 'usuario_id')
        : user.id;
    if (usuarioId !== user.id) assertUsuario(db, usuarioId);

    const comarcaId = requiredInt(body.comarca_id, 'comarca_id');
    assertComarca(db, comarcaId);

    const status = hasOwn(body, 'status')
      ? enumValue(body.status, STATUS, 'status')
      : 'ABERTO';

    const result = db
      .prepare(
        `INSERT INTO chamados (
           usuario_id, comarca_id, numero_os, tipo, setor, pessoa_contato,
           matricula_contato, telefone_contato, defeito_relatado,
           solucao_aplicada, observacoes, status, data_atendimento
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        usuarioId,
        comarcaId,
        requiredString(body.numero_os, 'numero_os', 30),
        enumValue(body.tipo, TIPOS, 'tipo'),
        optionalString(body.setor, 'setor', 100) ?? null,
        optionalString(body.pessoa_contato, 'pessoa_contato', 100) ?? null,
        optionalString(body.matricula_contato, 'matricula_contato', 20) ?? null,
        optionalString(body.telefone_contato, 'telefone_contato', 30) ?? null,
        optionalString(body.defeito_relatado, 'defeito_relatado', 10_000) ?? null,
        optionalString(body.solucao_aplicada, 'solucao_aplicada', 10_000) ?? null,
        optionalString(body.observacoes, 'observacoes', 10_000) ?? null,
        status,
        dateValue(body.data_atendimento, 'data_atendimento')
      );

    return {
      status: 201,
      data: getChamadoCompleto(db, Number(result.lastInsertRowid), user),
    };
  });

  router.get('/api/chamados/:id', ({ params, db, user }) => {
    const id = requiredInt(params.id, 'id');
    return { data: getChamadoCompleto(db, id, user) };
  });

  router.put('/api/chamados/:id', ({ params, body, db, user }) => {
    ensureObject(body);
    const id = requiredInt(params.id, 'id');
    getChamadoAcessivel(db, id, user);

    const setters = [];
    const values = [];
    const set = (column, value) => {
      if (value !== undefined) {
        setters.push(`${column} = ?`);
        values.push(value);
      }
    };

    if (hasOwn(body, 'usuario_id')) {
      const usuarioId = requiredInt(body.usuario_id, 'usuario_id');
      if (user.papel !== 'ADMIN' && usuarioId !== user.id) {
        throw new ApiError(403, 'FORBIDDEN', 'Somente administradores podem reatribuir chamados.');
      }
      if (usuarioId !== user.id) assertUsuario(db, usuarioId);
      set('usuario_id', usuarioId);
    }

    if (hasOwn(body, 'comarca_id')) {
      const comarcaId = requiredInt(body.comarca_id, 'comarca_id');
      assertComarca(db, comarcaId);
      set('comarca_id', comarcaId);
    }

    if (hasOwn(body, 'numero_os')) {
      set('numero_os', requiredString(body.numero_os, 'numero_os', 30));
    }
    if (hasOwn(body, 'tipo')) {
      set('tipo', enumValue(body.tipo, TIPOS, 'tipo'));
    }
    if (hasOwn(body, 'status')) {
      set('status', enumValue(body.status, STATUS, 'status'));
    }
    if (hasOwn(body, 'data_atendimento')) {
      set('data_atendimento', dateValue(body.data_atendimento, 'data_atendimento'));
    }

    const textFields = [
      ['setor', 'setor', 100],
      ['pessoa_contato', 'pessoa_contato', 100],
      ['matricula_contato', 'matricula_contato', 20],
      ['telefone_contato', 'telefone_contato', 30],
      ['defeito_relatado', 'defeito_relatado', 10_000],
      ['solucao_aplicada', 'solucao_aplicada', 10_000],
      ['observacoes', 'observacoes', 10_000],
    ];
    for (const [column, field, maxLength] of textFields) {
      if (hasOwn(body, column)) {
        set(column, optionalString(body[column], field, maxLength) ?? null);
      }
    }

    if (setters.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Nenhum campo para atualizar.');
    }

    setters.push('atualizado_em = ?');
    values.push(nowIso(), id);
    db.prepare(`UPDATE chamados SET ${setters.join(', ')} WHERE id = ?`).run(...values);

    return { data: getChamadoCompleto(db, id, user) };
  });

  router.delete('/api/chamados/:id', ({ params, db, user }) => {
    const id = requiredInt(params.id, 'id');
    getChamadoAcessivel(db, id, user);
    db.prepare(
      `UPDATE chamados
       SET excluido_em = ?, atualizado_em = ?
       WHERE id = ?`
    ).run(nowIso(), nowIso(), id);
    return { status: 204 };
  });

  router.post('/api/chamados/:id/equipamentos', ({ params, body, db, user }) => {
    ensureObject(body);
    const chamadoId = requiredInt(params.id, 'id');
    getChamadoAcessivel(db, chamadoId, user);

    const result = db
      .prepare(
        `INSERT INTO equipamentos (
           chamado_id, patrimonio, serial, tipo_equipamento, modelo, fabricante,
           acao, tipo_movimentacao, local_verificacao, local_retirada, local_entrega
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        chamadoId,
        optionalString(body.patrimonio, 'patrimonio', 30) ?? null,
        optionalString(body.serial, 'serial', 50) ?? null,
        optionalString(body.tipo_equipamento, 'tipo_equipamento', 50) ?? null,
        optionalString(body.modelo, 'modelo', 80) ?? null,
        optionalString(body.fabricante, 'fabricante', 50) ?? null,
        enumValue(body.acao, ACOES, 'acao'),
        optionalEnum(body.tipo_movimentacao, MOVIMENTACOES, 'tipo_movimentacao') ?? null,
        optionalString(body.local_verificacao, 'local_verificacao', 150) ?? null,
        optionalString(body.local_retirada, 'local_retirada', 150) ?? null,
        optionalString(body.local_entrega, 'local_entrega', 150) ?? LOCAL_ENTREGA_PADRAO
      );

    const equipamento = db
      .prepare('SELECT * FROM equipamentos WHERE id = ?')
      .get(Number(result.lastInsertRowid));
    return { status: 201, data: { ...equipamento, checklist: [], acessorios: [] } };
  });

  router.put('/api/equipamentos/:id', ({ params, body, db, user }) => {
    ensureObject(body);
    const id = requiredInt(params.id, 'id');
    getEquipamentoAcessivel(db, id, user);

    const setters = [];
    const values = [];
    const set = (column, value) => {
      if (value !== undefined) {
        setters.push(`${column} = ?`);
        values.push(value);
      }
    };

    if (hasOwn(body, 'patrimonio')) set('patrimonio', optionalString(body.patrimonio, 'patrimonio', 30) ?? null);
    if (hasOwn(body, 'serial')) set('serial', optionalString(body.serial, 'serial', 50) ?? null);
    if (hasOwn(body, 'tipo_equipamento')) set('tipo_equipamento', optionalString(body.tipo_equipamento, 'tipo_equipamento', 50) ?? null);
    if (hasOwn(body, 'modelo')) set('modelo', optionalString(body.modelo, 'modelo', 80) ?? null);
    if (hasOwn(body, 'fabricante')) set('fabricante', optionalString(body.fabricante, 'fabricante', 50) ?? null);
    if (hasOwn(body, 'acao')) set('acao', enumValue(body.acao, ACOES, 'acao'));
    if (hasOwn(body, 'tipo_movimentacao')) set('tipo_movimentacao', optionalEnum(body.tipo_movimentacao, MOVIMENTACOES, 'tipo_movimentacao'));
    if (hasOwn(body, 'local_verificacao')) set('local_verificacao', optionalString(body.local_verificacao, 'local_verificacao', 150) ?? null);
    if (hasOwn(body, 'local_retirada')) set('local_retirada', optionalString(body.local_retirada, 'local_retirada', 150) ?? null);
    if (hasOwn(body, 'local_entrega')) set('local_entrega', optionalString(body.local_entrega, 'local_entrega', 150) ?? null);

    if (setters.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Nenhum campo para atualizar.');
    }

    setters.push('atualizado_em = ?');
    values.push(nowIso(), id);
    db.prepare(`UPDATE equipamentos SET ${setters.join(', ')} WHERE id = ?`).run(...values);

    const equipamento = db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(id);
    equipamento.checklist = db
      .prepare('SELECT * FROM checklist_verificacao WHERE equipamento_id = ? ORDER BY id')
      .all(id);
    equipamento.acessorios = db
      .prepare('SELECT * FROM acessorios WHERE equipamento_id = ? ORDER BY id')
      .all(id);
    return { data: equipamento };
  });

  router.delete('/api/equipamentos/:id', ({ params, db, user }) => {
    const id = requiredInt(params.id, 'id');
    getEquipamentoAcessivel(db, id, user);
    db.prepare('DELETE FROM equipamentos WHERE id = ?').run(id);
    return { status: 204 };
  });

  router.get('/api/chamados/:id/trocas', ({ params, db, user }) => {
    const chamadoId = requiredInt(params.id, 'id');
    getChamadoAcessivel(db, chamadoId, user);
    const rows = db
      .prepare(
        `SELECT t.*, er.patrimonio AS retirado_patrimonio,
                er.serial AS retirado_serial, er.modelo AS retirado_modelo,
                ei.patrimonio AS instalado_patrimonio,
                ei.serial AS instalado_serial, ei.modelo AS instalado_modelo
         FROM trocas t
         LEFT JOIN equipamentos er ON er.id = t.equip_retirado_id
         LEFT JOIN equipamentos ei ON ei.id = t.equip_instalado_id
         WHERE t.chamado_id = ?
         ORDER BY t.id DESC`
      )
      .all(chamadoId);
    return { data: rows };
  });

  router.post('/api/chamados/:id/trocas', ({ params, body, db, user }) => {
    ensureObject(body);
    const chamadoId = requiredInt(params.id, 'id');
    getChamadoAcessivel(db, chamadoId, user);

    const retiradoId = optionalInt(body.equip_retirado_id, 'equip_retirado_id');
    const instaladoId = optionalInt(body.equip_instalado_id, 'equip_instalado_id');
    if (!retiradoId && !instaladoId) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Informe pelo menos o equipamento retirado ou o instalado.'
      );
    }
    if (retiradoId) {
      assertEquipamentoDoChamado(db, retiradoId, chamadoId, 'equip_retirado_id');
    }
    if (instaladoId) {
      assertEquipamentoDoChamado(db, instaladoId, chamadoId, 'equip_instalado_id');
    }

    const dataTroca = hasOwn(body, 'data_troca')
      ? optionalDate(body.data_troca, 'data_troca') ?? nowIso()
      : nowIso();

    const result = db
      .prepare(
        `INSERT INTO trocas (
           chamado_id, equip_retirado_id, equip_instalado_id, local_retirada,
           local_entrega, data_troca, observacoes
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        chamadoId,
        retiradoId || null,
        instaladoId || null,
        optionalString(body.local_retirada, 'local_retirada', 150) ?? null,
        optionalString(body.local_entrega, 'local_entrega', 150) ?? LOCAL_ENTREGA_PADRAO,
        dataTroca,
        optionalString(body.observacoes, 'observacoes', 10_000) ?? null
      );

    const troca = db
      .prepare('SELECT * FROM trocas WHERE id = ?')
      .get(Number(result.lastInsertRowid));
    return { status: 201, data: troca };
  });

  router.get('/api/chamados/:id/documentos', ({ params, db, user }) => {
    const chamadoId = requiredInt(params.id, 'id');
    getChamadoAcessivel(db, chamadoId, user);
    return { data: listDocumentos(db, chamadoId) };
  });

  router.post('/api/chamados/:id/documentos', ({ params, body, db, user }) => {
    ensureObject(body);
    const chamadoId = requiredInt(params.id, 'id');
    getChamadoAcessivel(db, chamadoId, user);

    const tipoDoc = enumValue(body.tipo_doc, DOCUMENTOS, 'tipo_doc');
    const dados = hasOwn(body, 'dados') ? objectValue(body.dados, 'dados') : {};
    const result = db
      .prepare(
        `INSERT INTO documentos_gerados (chamado_id, tipo_doc, dados_json)
         VALUES (?, ?, ?)`
      )
      .run(chamadoId, tipoDoc, JSON.stringify(dados));

    const documento = db
      .prepare('SELECT * FROM documentos_gerados WHERE id = ?')
      .get(Number(result.lastInsertRowid));
    return { status: 201, data: publicDocumento(documento) };
  });
}

module.exports = { registerChamadoRoutes };
