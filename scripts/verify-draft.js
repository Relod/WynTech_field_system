/*
 * Teste de contrato do rascunho do gerador oficial do Laudo (Apps Script).
 *
 * O Web App oficial importa um arquivo JSON no formato:
 *   { "versao": 1, "dados": { ...campos do formulário... } }
 *
 * Este script extrai a função officialDraft() do protótipo, alimenta com os
 * dados de demonstração e valida os campos que o formulário oficial espera.
 * Não faz chamadas de rede e não altera o protótipo.
 *
 * Uso: npm run verify:draft
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const sourcePath = path.resolve(__dirname, '..', 'prototipo', 'src', 'app.js');
const source = fs.readFileSync(sourcePath, 'utf8');

const start = source.indexOf('const OFFICIAL_ACCESSORIES');
const end = source.indexOf('function downloadOfficialDraft', start);

if (start < 0 || end < 0) {
  throw new Error('Não foi possível localizar o bloco do gerador oficial em prototipo/src/app.js.');
}

const block = source.slice(start, end);

// Dados de demonstração equivalentes a DEFAULT_CALL/DEFAULT_GRADES.
// Mantenha apenas os campos usados por officialDraft().
const state = {
  call: {
    os: 'TR1185398',
    comarca: 'Pará de Minas',
    setor: 'Vara Cível — Gabinete',
    data: '14/10/2026',
    patrS: '100309615',
    serialS: 'PF39X109',
    fabricanteRetirado: 'DATEN',
    modeloRetirado: 'Notebook DCM4A-4',
    movimentacao: 'DEVOLUCAO',
    localVerif: 'Edifício Goiás',
    localRetirada: 'Fórum de Pará de Minas',
    localEntrega: 'Sala Polo Divinópolis',
    defeito: 'Substituição de notebook por término de contrato e rollout institucional do magistrado.',
    obs: 'Equipamento funcional, limpo e em bom estado de conservação.',
    acessorios: ['Cabo de energia', 'Fonte / carregador', 'Mouse', 'Teclado'],
    outros: 'Pasta de transporte executiva',
    avaria: false,
    avariaDesc: ''
  },
  grades: { 1: 'B', 2: 'B', 3: 'B', 4: 'B', 5: 'B', 6: 'B' }
};

const factory = new Function('state', `${block}\nreturn { officialDraft };`);
const { officialDraft } = factory(state);

function main() {
  const normal = officialDraft('laudo-normal');
  const rollout = officialDraft('laudo-rollout');

  assert.strictEqual(normal.versao, 1, 'versão do rascunho');
  assert.strictEqual(normal.dados.patrimonio, '100309615');
  assert.strictEqual(normal.dados.tarefa, 'TR1185398');
  assert.strictEqual(normal.dados.data, '2026-10-14', 'data deve estar em ISO');
  assert.strictEqual(normal.dados.movimento, 'Devolução');
  assert.strictEqual(normal.dados.destino, 'Estoque');
  assert.strictEqual(normal.dados.comarca, 'Pará de Minas');
  assert.strictEqual(normal.dados.entrega, 'Sala Polo Divinópolis');
  assert.strictEqual(normal.dados.avarias, 'Não');
  assert.strictEqual(normal.dados.quais, '');
  assert.strictEqual(normal.dados.a0, true, 'Cabo de Energia');
  assert.strictEqual(normal.dados.a4, false, 'Cabo de Dados / USB');
  assert.strictEqual(normal.dados.a5, true, 'Outros acessórios');
  assert.strictEqual(normal.dados.c0, 'Bom');
  assert.strictEqual(normal.dados.c5, 'Bom');

  for (let index = 0; index < 6; index += 1) {
    assert.strictEqual(typeof normal.dados[`a${index}`], 'boolean', `a${index} booleano`);
    assert.ok(
      ['Bom', 'Regular', 'Ruim'].includes(normal.dados[`c${index}`]),
      `c${index} deve ser Bom/Regular/Ruim`
    );
  }

  if (normal.dados.outros.trim()) {
    assert.strictEqual(normal.dados.a5, true, 'texto em outros exige a5 marcado');
  }
  if (normal.dados.avarias === 'Não') {
    assert.strictEqual(normal.dados.quais, '', 'sem avaria não deve ter descrição');
  }

  assert.strictEqual(rollout.dados.destino, 'Estoque');
  assert.strictEqual(rollout.dados.comarca, 'Divinópolis');
  assert.strictEqual(rollout.dados.entrega, 'Sala Polo Divinópolis');
  assert.ok(rollout.dados.justificativa.includes('Rollout'));

  console.log('OK — contrato do rascunho oficial validado.');
  console.log(`  Laudo:   ${normal.dados.patrimonio} · ${normal.dados.tarefa} · ${normal.dados.data} · ${normal.dados.destino}`);
  console.log(`  Rollout: ${rollout.dados.patrimonio} · ${rollout.dados.tarefa} · ${rollout.dados.destino} / ${rollout.dados.comarca}`);
  console.log('  Formato: { versao: 1, dados: { ... } } — importável em "Abrir rascunho" no gerador oficial.');
}

try {
  main();
} catch (err) {
  console.error('FALHA no contrato do rascunho oficial:', err.message);
  process.exit(1);
}
