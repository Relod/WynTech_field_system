# ADR 0002 — Gerador oficial como fonte do A4

- **Status:** aceito
- **Data:** 2026-10-19
- **Contexto:** O protótipo v0.7.0 possui Laudo Técnico Unificado e Romaneio em
  A4 já validados, com PDFs de referência. O gerador oficial em Google Apps
  Script é a fonte usada na operação e não deve ser alterado sem decisão
  separada.

## Decisão

Nesta versão, o console real **não reimplementa** o A4. Ele registra um snapshot
do documento, baixa o rascunho `{versao:1,dados:{...}}` e oferece um atalho para
o Web App oficial, que continua gerando o PDF/impressão.

## Motivos

- Preserva exatamente a fidelidade e a impressão já validadas.
- Evita duplicar regras, campos e CSS de impressão em dois lugares.
- Não exige alterar `google.script.run`, `buscarAtivo` ou `salvarLaudo`.
- Mantém o escopo do MVP no fluxo operacional e na rastreabilidade.
- Reduz risco de divergência entre o PDF oficial e o console.

## Consequências

Positivas:

- Uma única fonte de verdade para o documento final.
- Rascunho compatível com o importador existente.
- O console pode evoluir sem tocar no Apps Script.

Negativas:

- Dependência de disponibilidade/permissão do Google.
- O rascunho do MVP não captura acessórios/checklist completos; o operador
  confere no gerador.
- A impressão A4 não funciona offline no console.
- A URL oficial precisa ser configurada e protegida.

## Alternativas consideradas

- **Portar o A4 para o console agora:** maior esforço e risco de divergência;
  fica como evolução se o Apps Script for descontinuado.
- **Chamar o Apps Script por HTTP:** exigiria `doPost`/CORS ou proxy e mudaria o
  script, contrariando a restrição atual.
- **Gerar PDF no servidor:** exigiria biblioteca/dependência e um novo renderer.

## Critérios de revisão

Reavaliar se o Apps Script for descontinuado, se a operação exigir emissão
offline/em lote ou se o rascunho precisar carregar todos os campos do laudo. A
referência A4 permanece no protótipo e em `docs/conformidade-documental.md`.
