'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestContext } = require('./helpers');

test('API real — autenticação, chamados e documentos', async (t) => {
  const ctx = await createTestContext();

  try {
    let tecnicoToken;
    let adminToken;
    let tecnicoId;
    let chamadoId;
    let equipamentoRetiradoId;
    let equipamentoInstaladoId;

    await t.test('health é público e informa o banco', async () => {
      const result = await ctx.request('/api/health');
      assert.equal(result.status, 200);
      assert.equal(result.body.success, true);
      assert.equal(result.body.data.status, 'ok');
      assert.equal(result.body.data.database, 'ok');
    });

    await t.test('rotas protegidas exigem autenticação', async () => {
      const result = await ctx.request('/api/dashboard');
      assert.equal(result.status, 401);
      assert.equal(result.body.success, false);
      assert.equal(result.body.code, 'UNAUTHENTICATED');
    });

    await t.test('login inválido é rejeitado', async () => {
      const result = await ctx.request('/api/auth/login', {
        method: 'POST',
        body: { email: 'tecnico@wyntech.local', senha: 'senha-errada' },
      });
      assert.equal(result.status, 401);
      assert.equal(result.body.code, 'INVALID_CREDENTIALS');
    });

    await t.test('rate limit bloqueia tentativas repetidas de login', async () => {
      const rateCtx = await createTestContext({
        loginRateLimit: { windowMs: 60_000, max: 2 },
      });
      try {
        const attempt = () =>
          rateCtx.request('/api/auth/login', {
            method: 'POST',
            body: { email: 'rate-limit@wyntech.local', senha: 'senha-errada' },
          });
        assert.equal((await attempt()).status, 401);
        assert.equal((await attempt()).status, 401);
        const blocked = await attempt();
        assert.equal(blocked.status, 429);
        assert.equal(blocked.body.code, 'TOO_MANY_ATTEMPTS');
      } finally {
        await rateCtx.close();
      }
    });

    await t.test('login válido cria sessão e cookie HttpOnly', async () => {
      const result = await ctx.login('tecnico@wyntech.local', 'Wyntech@2026');
      assert.equal(result.status, 200);
      assert.ok(result.body.data.token);
      assert.equal(result.body.data.usuario.papel, 'TECNICO');
      assert.equal(result.body.data.config.version, '0.8.0');
      assert.equal(typeof result.body.data.config.officialLaudoUrl, 'string');
      tecnicoToken = result.body.data.token;
      tecnicoId = result.body.data.usuario.id;
      assert.match(result.headers.get('set-cookie'), /HttpOnly/);
    });

    await t.test('sessão aceita Bearer e cookie', async () => {
      const bearer = await ctx.request('/api/auth/me', { token: tecnicoToken });
      assert.equal(bearer.status, 200);
      assert.equal(bearer.body.data.usuario.email, 'tecnico@wyntech.local');

      const login = await ctx.login('tecnico@wyntech.local', 'Wyntech@2026');
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const viaCookie = await ctx.request('/api/auth/me', { cookie });
      assert.equal(viaCookie.status, 200);
      assert.equal(viaCookie.body.data.usuario.id, tecnicoId);
    });

    await t.test('logout revoga a sessão', async () => {
      const result = await ctx.request('/api/auth/logout', {
        method: 'POST',
        token: tecnicoToken,
      });
      assert.equal(result.status, 200);
      const after = await ctx.request('/api/auth/me', { token: tecnicoToken });
      assert.equal(after.status, 401);
    });

    await t.test('admin também autentica', async () => {
      const result = await ctx.login('admin@wyntech.local', 'Wyntech@2026');
      assert.equal(result.status, 200);
      assert.equal(result.body.data.usuario.papel, 'ADMIN');
      adminToken = result.body.data.token;
    });

    await t.test('lista de comarcas vem do banco', async () => {
      const login = await ctx.login('tecnico@wyntech.local', 'Wyntech@2026');
      tecnicoToken = login.body.data.token;
      const result = await ctx.request('/api/comarcas', { token: tecnicoToken });
      assert.equal(result.status, 200);
      assert.ok(result.body.data.length >= 8);
      assert.ok(result.body.data.some((comarca) => comarca.nome === 'Pará de Minas'));
    });

    await t.test('cria chamado com dados válidos', async () => {
      const comarcas = await ctx.request('/api/comarcas', { token: tecnicoToken });
      const comarcaId = comarcas.body.data[0].id;

      const result = await ctx.request('/api/chamados', {
        method: 'POST',
        token: tecnicoToken,
        body: {
          numero_os: 'TR1185398',
          tipo: 'IN',
          comarca_id: comarcaId,
          setor: 'Sala Polo',
          pessoa_contato: 'Renan Almeida',
          matricula_contato: '123456',
          telefone_contato: '(37) 99999-0000',
          defeito_relatado: 'Equipamento não liga.',
          data_atendimento: '2026-10-19',
        },
      });

      assert.equal(result.status, 201);
      assert.equal(result.body.data.numero_os, 'TR1185398');
      assert.equal(result.body.data.usuario_id, tecnicoId);
      assert.equal(result.body.data.status, 'ABERTO');
      assert.deepEqual(result.body.data.equipamentos, []);
      assert.deepEqual(result.body.data.documentos, []);
      chamadoId = result.body.data.id;
    });

    await t.test('validação impede chamado sem OS e com data inválida', async () => {
      const comarcas = await ctx.request('/api/comarcas', { token: tecnicoToken });
      const comarcaId = comarcas.body.data[0].id;

      const semOs = await ctx.request('/api/chamados', {
        method: 'POST',
        token: tecnicoToken,
        body: { tipo: 'IN', comarca_id: comarcaId, data_atendimento: '2026-10-19' },
      });
      assert.equal(semOs.status, 400);

      const dataInvalida = await ctx.request('/api/chamados', {
        method: 'POST',
        token: tecnicoToken,
        body: {
          numero_os: 'TR0000001',
          tipo: 'IN',
          comarca_id: comarcaId,
          data_atendimento: '2026-02-30',
        },
      });
      assert.equal(dataInvalida.status, 400);
    });

    await t.test('lista, busca e paginação funcionam', async () => {
      const result = await ctx.request(
        '/api/chamados?busca=TR1185&status=ABERTO&page=1&limit=10',
        { token: tecnicoToken }
      );
      assert.equal(result.status, 200);
      assert.equal(result.body.data.length, 1);
      assert.equal(result.body.meta.total, 1);
      assert.equal(result.body.meta.page, 1);
      assert.equal(result.body.meta.limit, 10);
    });

    await t.test('atualiza status e solução do chamado', async () => {
      const result = await ctx.request(`/api/chamados/${chamadoId}`, {
        method: 'PUT',
        token: tecnicoToken,
        body: {
          status: 'EM_ANDAMENTO',
          solucao_aplicada: 'Substituição da fonte de alimentação.',
        },
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.data.status, 'EM_ANDAMENTO');
      assert.equal(
        result.body.data.solucao_aplicada,
        'Substituição da fonte de alimentação.'
      );
    });

    await t.test('adiciona equipamentos e atualiza um deles', async () => {
      const retirado = await ctx.request(`/api/chamados/${chamadoId}/equipamentos`, {
        method: 'POST',
        token: tecnicoToken,
        body: {
          patrimonio: '100309615',
          serial: 'SN-001',
          tipo_equipamento: 'Desktop',
          modelo: 'OptiPlex 7080',
          fabricante: 'Dell',
          acao: 'RETIRADA',
          tipo_movimentacao: 'MANUTENCAO',
          local_retirada: 'Sala Polo',
          local_entrega: 'Sala Polo Divinópolis',
        },
      });
      assert.equal(retirado.status, 201);
      equipamentoRetiradoId = retirado.body.data.id;
      assert.equal(retirado.body.data.local_entrega, 'Sala Polo Divinópolis');

      const instalado = await ctx.request(`/api/chamados/${chamadoId}/equipamentos`, {
        method: 'POST',
        token: tecnicoToken,
        body: {
          patrimonio: '100309616',
          serial: 'SN-002',
          tipo_equipamento: 'Desktop',
          modelo: 'OptiPlex 7010',
          fabricante: 'Dell',
          acao: 'INSTALACAO',
          local_entrega: 'Sala Polo Divinópolis',
        },
      });
      assert.equal(instalado.status, 201);
      equipamentoInstaladoId = instalado.body.data.id;

      const atualizado = await ctx.request(`/api/equipamentos/${equipamentoInstaladoId}`, {
        method: 'PUT',
        token: tecnicoToken,
        body: { modelo: 'OptiPlex 7010 Plus' },
      });
      assert.equal(atualizado.status, 200);
      assert.equal(atualizado.body.data.modelo, 'OptiPlex 7010 Plus');
    });

    await t.test('registra troca vinculada aos equipamentos', async () => {
      const result = await ctx.request(`/api/chamados/${chamadoId}/trocas`, {
        method: 'POST',
        token: tecnicoToken,
        body: {
          equip_retirado_id: equipamentoRetiradoId,
          equip_instalado_id: equipamentoInstaladoId,
          local_retirada: 'Sala Polo',
          local_entrega: 'Sala Polo Divinópolis',
          data_troca: '2026-10-19',
          observacoes: 'Troca concluída.',
        },
      });
      assert.equal(result.status, 201);
      assert.equal(result.body.data.chamado_id, chamadoId);

      const lista = await ctx.request(`/api/chamados/${chamadoId}/trocas`, {
        token: tecnicoToken,
      });
      assert.equal(lista.status, 200);
      assert.equal(lista.body.data.length, 1);

      const dataInvalida = await ctx.request(`/api/chamados/${chamadoId}/trocas`, {
        method: 'POST',
        token: tecnicoToken,
        body: {
          equip_retirado_id: equipamentoRetiradoId,
          data_troca: '2026-02-30',
        },
      });
      assert.equal(dataInvalida.status, 400);
      assert.equal(dataInvalida.body.code, 'VALIDATION_ERROR');
    });

    await t.test('registra e recupera documento gerado', async () => {
      const result = await ctx.request(`/api/chamados/${chamadoId}/documentos`, {
        method: 'POST',
        token: tecnicoToken,
        body: {
          tipo_doc: 'LAUDO',
          dados: {
            patrimonio: '100309615',
            os: 'TR1185398',
            resumo: 'Laudo técnico de demonstração.',
          },
        },
      });
      assert.equal(result.status, 201);
      assert.equal(result.body.data.tipo_doc, 'LAUDO');
      assert.equal(result.body.data.dados.os, 'TR1185398');

      const lista = await ctx.request(`/api/chamados/${chamadoId}/documentos`, {
        token: tecnicoToken,
      });
      assert.equal(lista.status, 200);
      assert.equal(lista.body.data.length, 1);
    });

    await t.test('detalhe consolida equipamentos, trocas e documentos', async () => {
      const result = await ctx.request(`/api/chamados/${chamadoId}`, {
        token: tecnicoToken,
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.data.equipamentos.length, 2);
      assert.equal(result.body.data.trocas.length, 1);
      assert.equal(result.body.data.documentos.length, 1);
      assert.equal(result.body.data.equipamentos[0].checklist.length, 0);
    });

    await t.test('dashboard reflete o chamado em andamento', async () => {
      const result = await ctx.request('/api/dashboard', { token: tecnicoToken });
      assert.equal(result.status, 200);
      assert.equal(result.body.data.resumo.total, 1);
      assert.equal(result.body.data.resumo.em_andamento, 1);
      assert.equal(result.body.data.recentes[0].id, chamadoId);
    });

    await t.test('técnico não acessa chamado de outro usuário', async () => {
      const comarcas = await ctx.request('/api/comarcas', { token: adminToken });
      const comarcaId = comarcas.body.data[0].id;
      const adminChamado = await ctx.request('/api/chamados', {
        method: 'POST',
        token: adminToken,
        body: {
          numero_os: 'TR9999999',
          tipo: 'TR',
          comarca_id: comarcaId,
          data_atendimento: '2026-10-19',
          setor: 'Administração',
        },
      });
      assert.equal(adminChamado.status, 201);
      const adminChamadoId = adminChamado.body.data.id;
      const adminEquipamento = await ctx.request(`/api/chamados/${adminChamadoId}/equipamentos`, {
        method: 'POST',
        token: adminToken,
        body: { patrimonio: 'ADMIN-001', acao: 'VERIFICACAO' },
      });
      assert.equal(adminEquipamento.status, 201);
      const adminEquipamentoId = adminEquipamento.body.data.id;

      const negado = await ctx.request(`/api/chamados/${adminChamadoId}`, {
        token: tecnicoToken,
      });
      assert.equal(negado.status, 404);

      const equipamentoNegado = await ctx.request(`/api/equipamentos/${adminEquipamentoId}`, {
        method: 'PUT',
        token: tecnicoToken,
        body: { modelo: 'Tentativa indevida' },
      });
      assert.equal(equipamentoNegado.status, 404);

      const permitido = await ctx.request(`/api/chamados/${chamadoId}`, {
        token: adminToken,
      });
      assert.equal(permitido.status, 200);
    });

    await t.test('exclusão é lógica e remove da listagem', async () => {
      const result = await ctx.request(`/api/chamados/${chamadoId}`, {
        method: 'DELETE',
        token: tecnicoToken,
      });
      assert.equal(result.status, 204);

      const detalhe = await ctx.request(`/api/chamados/${chamadoId}`, {
        token: tecnicoToken,
      });
      assert.equal(detalhe.status, 404);

      const dashboard = await ctx.request('/api/dashboard', { token: tecnicoToken });
      assert.equal(dashboard.body.data.resumo.total, 0);
    });

    await t.test('troca de senha valida a senha atual e revoga outras sessões', async () => {
      const extraSession = await ctx.login('tecnico@wyntech.local', 'Wyntech@2026');
      const extraToken = extraSession.body.data.token;

      const senhaErrada = await ctx.request('/api/auth/alterar-senha', {
        method: 'POST',
        token: tecnicoToken,
        body: { senha_atual: 'senha-incorreta', nova_senha: 'NovaSenha@2026' },
      });
      assert.equal(senhaErrada.status, 401);
      assert.equal(senhaErrada.body.code, 'INVALID_CREDENTIALS');

      const alterada = await ctx.request('/api/auth/alterar-senha', {
        method: 'POST',
        token: tecnicoToken,
        body: { senha_atual: 'Wyntech@2026', nova_senha: 'NovaSenha@2026' },
      });
      assert.equal(alterada.status, 200);

      const sessaoAtual = await ctx.request('/api/auth/me', { token: tecnicoToken });
      assert.equal(sessaoAtual.status, 200);

      const sessaoRevogada = await ctx.request('/api/auth/me', { token: extraToken });
      assert.equal(sessaoRevogada.status, 401);

      const loginAntigo = await ctx.request('/api/auth/login', {
        method: 'POST',
        body: { email: 'tecnico@wyntech.local', senha: 'Wyntech@2026' },
      });
      assert.equal(loginAntigo.status, 401);

      const loginNovo = await ctx.login('tecnico@wyntech.local', 'NovaSenha@2026');
      assert.equal(loginNovo.status, 200);
    });
  } finally {
    await ctx.close();
  }
});
