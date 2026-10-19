/*
 * Valida o contrato do rascunho oficial do Laudo/Romaneio.
 *
 * O Web App importa um arquivo no formato:
 *   { "versao": 1, "dados": { ...campos do formulario... } }
 *
 * O script valida a implementacao do prototipo e a do MVP real sem fazer
 * chamadas de rede e sem alterar arquivos.
 *
 * Uso: npm run verify:draft
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');

function extract(file, startMarker, endMarker) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`Nao foi possivel localizar ${startMarker} em ${file}.`);
  }
  return source.slice(start, end);
}

function validateAccessoriesAndGrades(dados) {
  for (let index = 0; index < 6; index += 1) {
    assert.equal(typeof dados[`a${index}`], 'boolean', `a${index} deve ser booleano`);
    assert.ok(
      ['Bom', 'Regular', 'Ruim'].includes(dados[`c${index}`]),
      `c${index} deve ser Bom/Regular/Ruim`
    );
  }
}

function verifyPrototype() {
  const block = extract(
    path.join(root, 'prototipo', 'src', 'app.js'),
    'const OFFICIAL_ACCESSORIES',
    'function downloadOfficialDraft'
  );

  const state = {
    call: {
      os: 'TR1185398',
      comarca: 'Pará de Minas',
      setor: 'Vara Cível - Gabinete',
      data: '14/10/2026',
      patrS: '100309615',
      serialS: 'PF39X109',
      fabricanteRetirado: 'DATEN',
      modeloRetirado: 'Notebook DCM4A-4',
      movimentacao: 'DEVOLUCAO',
      localVerif: 'Edifício Goiás',
      localRetirada: 'Fórum de Pará de Minas',
      localEntrega: 'Sala Polo Divinópolis',
      defeito: 'Substituição de notebook por término de contrato.',
      obs: 'Equipamento funcional e limpo.',
      acessorios: ['Cabo de energia', 'Fonte / carregador', 'Mouse', 'Teclado'],
      outros: 'Pasta de transporte executiva',
      avaria: false,
      avariaDesc: '',
    },
    grades: { 1: 'B', 2: 'B', 3: 'B', 4: 'B', 5: 'B', 6: 'B' },
  };

  const factory = new Function('state', `${block}\nreturn { officialDraft };`);
  const { officialDraft } = factory(state);
  const normal = officialDraft('laudo-normal');
  const rollout = officialDraft('laudo-rollout');

  assert.equal(normal.versao, 1);
  assert.equal(normal.dados.patrimonio, '100309615');
  assert.equal(normal.dados.tarefa, 'TR1185398');
  assert.equal(normal.dados.data, '2026-10-14');
  assert.equal(normal.dados.movimento, 'Devolução');
  assert.equal(normal.dados.destino, 'Estoque');
  assert.equal(normal.dados.comarca, 'Pará de Minas');
  assert.equal(normal.dados.entrega, 'Sala Polo Divinópolis');
  assert.equal(normal.dados.avarias, 'Não');
  assert.equal(normal.dados.quais, '');
  assert.equal(normal.dados.a0, true);
  assert.equal(normal.dados.a4, false);
  assert.equal(normal.dados.a5, true);
  validateAccessoriesAndGrades(normal.dados);

  assert.equal(rollout.dados.destino, 'Estoque');
  assert.equal(rollout.dados.comarca, 'Divinópolis');
  assert.equal(rollout.dados.entrega, 'Sala Polo Divinópolis');
  assert.ok(rollout.dados.justificativa.includes('Rollout'));
  validateAccessoriesAndGrades(rollout.dados);

  console.log('OK - contrato do rascunho do prototipo validado.');
  console.log(`  Laudo:   ${normal.dados.patrimonio} / ${normal.dados.tarefa} / ${normal.dados.data}`);
  console.log(`  Rollout: ${rollout.dados.patrimonio} / ${rollout.dados.tarefa} / ${rollout.dados.destino}`);
}

function verifyMvp() {
  const block = extract(
    path.join(root, 'public', 'app.js'),
    'function draftFromChamado',
    'function baixarRascunho'
  );
  const makeDraft = new Function('chamado', `${block}\nreturn draftFromChamado(chamado);`);
  const draft = makeDraft({
    numero_os: 'TR1185398',
    data_atendimento: '2026-10-19',
    comarca_nome: 'Belo Horizonte',
    setor: 'Sala Polo',
    defeito_relatado: 'Equipamento nao liga',
    observacoes: 'Atendimento concluido.',
    equipamentos: [
      {
        id: 10,
        patrimonio: '100309615',
        serial: 'SN-001',
        modelo: 'OptiPlex',
        fabricante: 'Dell',
        acao: 'VERIFICACAO',
        tipo_movimentacao: null,
        local_verificacao: 'Sala Polo',
        local_retirada: 'Sala Polo',
        local_entrega: 'Sala Polo Divinopolis',
      },
      {
        id: 11,
        patrimonio: '100309617',
        serial: 'SN-003',
        modelo: 'OptiPlex 7090',
        fabricante: 'Dell',
        acao: 'INSTALACAO',
        tipo_movimentacao: null,
        local_verificacao: '',
        local_retirada: '',
        local_entrega: 'Sala Polo Divinopolis',
      },
    ],
    trocas: [{ id: 1, equip_retirado_id: 10, equip_instalado_id: 11 }],
  });

  const required = [
    'comarcaAtendimento', 'patrimonio', 'tarefa', 'data', 'movimento',
    'verificacao', 'retirada', 'entrega', 'serie', 'modelo', 'fabricante',
    'outros', 'justificativa', 'outroItem', 'avarias', 'quais', 'observacoes',
    'destino', 'comarca', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
    'c0', 'c1', 'c2', 'c3', 'c4', 'c5',
  ];

  assert.equal(draft.versao, 1);
  for (const field of required) {
    assert.ok(Object.prototype.hasOwnProperty.call(draft.dados, field), `campo ${field}`);
  }
  assert.equal(draft.dados.patrimonio, '100309615');
  assert.equal(draft.dados.tarefa, 'TR1185398');
  assert.equal(draft.dados.data, '2026-10-19');
  assert.equal(draft.dados.movimento, 'Devolução');
  assert.equal(draft.dados.destino, 'Estoque');
  assert.equal(draft.dados.avarias, 'Não');
  validateAccessoriesAndGrades(draft.dados);

  console.log('OK - contrato do rascunho do MVP real validado.');
}

try {
  verifyPrototype();
  verifyMvp();
} catch (error) {
  console.error('FALHA no contrato do rascunho oficial:', error.message);
  process.exit(1);
}
