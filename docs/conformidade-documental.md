# Conformidade documental — Laudo e Romaneio

**Versão:** 0.7.0 · **Atualizado em:** 19/10/2026

Este documento registra o escopo documental do protótipo, a estrutura dos dois
documentos gerados pela Wyntech e as decisões de fidelidade em relação aos
modelos oficiais do TJMG. Ele complementa
[`architecture.md`](../architecture.md) e
[`integracao-apps-script.md`](integracao-apps-script.md).

## 1. Escopo

### Documentos gerados pela Wyntech

1. **Laudo Técnico Unificado v5.0** — usado tanto no atendimento normal quanto
   no rollout. O mesmo modelo é emitido nos modos **Preenchido** e **Em
   branco**.
2. **Romaneio de Substituição de Equipamento** — documento de transporte e
   conferência da substituição. Também tem modo **Preenchido** e **Em branco**.

### Documentos externos (não gerados)

- **RAT** — Relatório de Atendimento Técnico, do HP/TJMG.
- **Guia de Transferência** — anexada pelo HP/TJMG na tarefa de transporte.
- **Termo de Substituição** — documento do TJMG; só vale com a assinatura do
  magistrado.

O sistema **cobra** esses documentos no checklist e nos lembretes de campo, mas
não os emite. Essa separação é intencional e está refletida na tela de
Documentos e nas regras de fechamento.

## 2. Laudo Técnico Unificado v5.0

### 2.1 Estrutura

O Laudo segue o modelo **PRINT 02 · v5.0**:

- cabeçalho com identificação Wyntech, título centralizado **LAUDO TÉCNICO**,
  subtítulo “Movimentação e Verificação de Equipamento de Informática” e linha
  divisória;
- seções numeradas em faixas cinza:
  - **I. Identificação e Movimentação**
  - **II. Entrega com**
  - **III. Checklist de Verificação**
  - **IV. Avarias**
  - **V. Observações Gerais**
  - **VI. Declaração**
  - **VII. Assinaturas**
- rodapé “Laudo Técnico WYNTECH — Modelo oficial de uso interno”.

### 2.2 Campos e layout

- Os rótulos ficam **em bloco, acima do valor**, como no modelo oficial; não
  são labels inline.
- A seção I cobre OS/tarefa/incidente, data de atendimento, tipo de
  movimentação (Manutenção/Devolução), local de verificação, local de retirada,
  local de entrega, patrimônio, número de série, tipo/modelo, fabricante e
  justificativa.
- A seção II lista os acessórios: cabo de energia, fonte/carregador, mouse,
  teclado, cabo de dados/USB e “Outros”, com o texto do outro item.
- A seção III tem seis linhas de checklist; a coluna Wyntech usa
  **Bom/Regular/Ruim**; a coluna TJMG é preenchida manualmente.
- A linha 6 é **“Outro item relevante ao equipamento”**.
- A seção IV pergunta se foram encontradas avarias e abre espaço para a
  descrição.
- A seção V é uma caixa de observações.
- A seção VI traz a declaração de recolhimento para **Manutenção** ou
  **Estoque para a Sala Polo da comarca**.
- A seção VII tem três assinaturas: Responsável Técnico Wyntech, Responsável
  TJMG e Entregue para/Recebido por.

### 2.3 Rollout x atendimento normal

O **Laudo de Rollout** usa o mesmo modelo do Laudo Técnico. As diferenças são
de conteúdo, não de template:

- movimentação **Devolução**;
- destino **Estoque**;
- comarca da Sala Polo **Divinópolis** no cenário de demonstração;
- local de entrega **Sala Polo Divinópolis**;
- justificativa e observações padrão do rollout.

No atendimento normal, os dados vêm do chamado; quando a movimentação é
**Manutenção**, a declaração usa a opção “Manutenção” e não a Sala Polo.

### 2.4 Modo em branco

O modo **Em branco** existe para contingência de impressão/assinatura manual.
Ele mantém rótulos, faixas, caixas e linhas de assinatura, mas deixa os valores
e checkboxes vazios. Não é um PDF separado: é o mesmo template renderizado sem
os dados.

## 3. Romaneio de Substituição

O Romaneio segue o modelo oficial usado pelo TJMG e deve permanecer fiel à
segunda referência enviada. A estrutura implementada é:

- cabeçalho com identificação TJMG e Wyntech;
- título **SUBSTITUIÇÃO DE EQUIPAMENTO**;
- faixas cinza de metadados: comarca/unidade, incidente, data de retirada e
  horário;
- tabela do equipamento substituído (S:) com modelo, patrimônio e série;
- tabela do equipamento instalado (I:) com modelo, patrimônio e série;
- caixa de **OBSERVAÇÕES** com área ampliada para o texto de transporte;
- tabela de assinaturas: usuário, técnico e responsável pelo transporte, com
  matrícula e espaço de assinatura;
- data por extenso no pé da página.

O layout prioriza a impressão em uma única folha A4, com as faixas de
preenchimento e os campos oficiais.

## 4. Decisões de fidelidade

### 4.1 Checkboxes desenhados em CSS

Os checkboxes do Laudo são desenhados com borda e check em CSS, em vez de
depender dos glifos Unicode `☐`/`☑`. Em fontes pequenas, o glifo do check fica
quase invisível na pré-visualização e na impressão. A solução em CSS mantém o
estado **marcado** legível em tela e em papel.

### 4.2 Rótulos em bloco

A primeira versão do protótipo chegou a usar rótulo e valor na mesma linha.
O modelo oficial usa o rótulo em negrito acima do valor; a versão final voltou
ao bloco, inclusive nas tabelas da seção I.

### 4.3 Assinaturas no pé da folha

O bloco de assinaturas do Laudo é ancorado no pé da A4 (com `margin-top: auto`
no container flex), como no modelo impresso. O espaço restante fica entre a
declaração e as assinaturas, e não depois delas.

### 4.4 POP030 preservado

O texto do POP030 na tela é orientado pelos dados e reproduz o conteúdo oficial
da seção 9.1 do documento de arquitetura (Versão 3.5 — FEV/2025), inclusive
particularidades de redação do documento original. **Não “corrija” o texto do
POP030 sem validação da COATEC**: a fidelidade ao script oficial é intencional.

### 4.5 Cabeçalho TJMG do checklist

O cabeçalho da coluna TJMG e o conteúdo das células seguem o modelo oficial,
mesmo que a nomenclatura “OK/NOK” do cabeçalho não coincida literalmente com
“Bom/Regular/Ruim” das células. Essa aparente inconsistência foi preservada do
modelo; não é um bug do protótipo.

### 4.6 Logos e identidade visual

Os logos dos documentos são **representações tipográficas** no protótipo
(bloco “WYNTECH” e wordmark “TJMG”), não os arquivos oficiais de marca. Antes
de produção, substitua-os pelos arquivos institucionais fornecidos pelo
TJMG/Wyntech. O restante do layout (faixas, campos, assinaturas e rodapé) está
implementado.

### 4.7 Impressão sem PDF falso

Não há geração de PDF por biblioteca no protótipo. A ação **Imprimir / Salvar
PDF** usa `window.print()` e o CSS `@media print`, isolando a folha A4. Isso
evita um PDF de baixa qualidade e mantém o documento idêntico ao que está na
tela. O gerador oficial do Apps Script continua sendo a via para o PDF oficial
com consulta ao SIAD.

## 5. Impressão e evidências

- Formato: A4 retrato (`@page size: A4 portrait; margin: 10mm 8mm`).
- Cinco PDFs de validação em [`exemplos/`](exemplos/):
  - Laudo de atendimento (preenchido);
  - Laudo de rollout (preenchido);
  - Laudo em branco;
  - Romaneio preenchido;
  - Romaneio em branco.
- Todos com **1 página** e MediaBox A4 `594,96 × 841,92 pt`.
- `print-color-adjust: exact` mantém as faixas cinza e a linha vermelha mesmo
  com “Gráficos de plano de fundo” desligado.
- Capturas em [`capturas/`](capturas/).

## 6. Limitações conhecidas

- Logos oficiais ainda são placeholders tipográficos (item 4.6).
- A fidelidade é de layout e conteúdo, não pixel-perfect em relação às imagens
  de referência; fontes do sistema podem variar entre estações.
- O gerador oficial do Apps Script é a fonte do PDF com consulta ao SIAD; o
  PDF local é a contingência offline.
- Dados de demonstração são fictícios. Não use este repositório para armazenar
  dados reais de atendimento.

## 7. Referências

- Modelos oficiais enviados pelo usuário (Laudo PRINT 02 v5.0 e Romaneio).
- `architecture.md` — regras de negócio, POP030 e decisões.
- `prototipo/src/app.js` — funções `renderLaudoSheet()` e
  `renderRomaneioSheet()`.
- `prototipo/src/styles.css` — regras `.laudo-*`, `.romaneio-*` e `@media print`.
- `docs/exemplos/` — PDFs de validação.
