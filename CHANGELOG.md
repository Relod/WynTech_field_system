# Changelog

Todas as mudanças relevantes do projeto Wyntech Campo TJMG.

## [0.7.0] — 2026-10-19

### Adicionado

- Protótipo final navegável com 8 telas: Painel, Chamado, Equipamento, POP030,
  Rollout, Fechamento, Documentos e Histórico.
- Layout responsivo para desktop e mobile, com sidebar, topbar e bottom nav.
- Laudo Técnico Unificado v5.0 (atendimento e rollout) e Romaneio de
  Substituição em A4, com modos Preenchido e Em branco.
- Impressão local via `window.print()`, com CSS `@page` A4, isolamento da folha
  e `print-color-adjust: exact` para preservar faixas e cores.
- Painel “Gerador oficial do Laudo” na tela Documentos, com abertura do Web App
  do Apps Script e exportação de rascunho JSON para “Abrir rascunho”.
- Mapeamento do rascunho oficial para os campos `comarcaAtendimento`,
  `patrimonio`, `tarefa`, `data`, `movimento`, `verificacao`, `retirada`,
  `entrega`, `serie`, `modelo`, `fabricante`, `outros`, `justificativa`,
  `outroItem`, `avarias`, `quais`, `observacoes`, `destino`, `comarca`,
  `a0..a5` e `c0..c5`.
- Estrutura de projeto com fontes em `prototipo/src/`, build em
  `prototipo/build.js`, preview em `scripts/serve.js` e teste de contrato em
  `scripts/verify-draft.js`.
- Documentação: `README.md`, `docs/integracao-apps-script.md`,
  `docs/conformidade-documental.md`, capturas e PDFs de exemplo.

### Alterado

- Reescrita completa do protótipo com design system sóbrio, sem frameworks,
  sem emojis, sem gradientes e com fontes do sistema.
- Cabeçalho, faixas, labels e checkboxes dos documentos ajustados às
  referências oficiais; checkboxes desenhados em CSS para legibilidade.
- Rodapé de assinaturas do Laudo ancorado no pé da folha.
- Build passou a ler as fontes da pasta do projeto, sem caminhos temporários.
- `architecture.md` atualizado para a versão 0.7.0 com o estado real do
  protótipo e a integração oficial.

### Validado

- Capturas desktop e mobile das 8 telas.
- Laudo e Romaneio nos modos preenchido e em branco.
- Rascunho oficial gerado no navegador e validado contra o formulário do Apps
  Script (`npm run verify:draft`).
- Impressão de 5 PDFs, todos em uma página A4 (594,96 × 841,92 pt), com fundos
  preservados mesmo sem “Gráficos de plano de fundo”.

### Pendente

- Prefill automático do gerador oficial em um clique: exige alterar o
  `doGet`/HTML do Apps Script e republicar. Ver
  `docs/integracao-apps-script.md`.
- Backend de produção, autenticação e sincronização com o HP Service Manager
  continuam fora do escopo do protótipo.

## [0.6.0] — 2026-10-19

### Corrigido

- Consistência documental e eliminação de contradições entre arquitetura,
  regras de negócio e protótipo.
- Mapeamento das rotas hash para as telas do protótipo.
- Stack e fontes documentadas; distinção entre documentos gerados e externos.

## [0.5.0] — 2026-10-14

### Adicionado

- Fidelidade documental 1:1 do Laudo e do Romaneio e ajustes de navegação.
- Modos de contingência em branco e ações de exportação/compartilhamento.

## [0.1.0] — 2026-10-13

### Adicionado

- Documento de arquitetura inicial, regras operacionais COATEC/Wyntech e
  primeiras telas do protótipo.
