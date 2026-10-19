# 01 — Visão geral

## Objetivo

Substituir o registro disperso de atendimentos de campo por um console único
para a operação Wyntech/TJMG: abrir o chamado, registrar o equipamento, a troca,
o laudo/romaneio e manter o histórico consultável.

O MVP real parte do **protótipo v0.7.0 aprovado**. O protótipo continua sendo a
referência de design e dos documentos A4; o sistema real implementa a operação
com banco, autenticação e API.

## Pessoas usuárias

| Persona | Necessidade principal |
| --- | --- |
| Técnico de campo | Registrar rapidamente o atendimento e os equipamentos pelo celular. |
| Analista/supervisor | Acompanhar chamados, status e documentos. |
| Administrador | Acessar todos os chamados e reatribuir responsáveis pela API. |
| Equipe Wyntech/TJMG | Manter o padrão documental e a rastreabilidade. |

## Escopo entregue no MVP

- Autenticação com usuários ativos, papéis e sessões revogáveis.
- Painel operacional com resumo e chamados recentes.
- CRUD de chamados com filtros, busca e paginação.
- Equipamentos vinculados ao chamado.
- Trocas entre equipamento retirado e instalado.
- Registro de snapshots de documentos e download do rascunho oficial.
- Atalho configurável para o gerador oficial.
- Tela de perfil e troca de senha.
- Layout responsivo e acessível por teclado.
- Migrações, seed, testes e documentação de operação.

## Fora do escopo desta versão

- Renderização/impressão A4 dentro do console real (permanece no Apps Script).
- Administração de usuários pela interface.
- Upload de fotos, anexos e assinatura digital.
- Notificações, e-mail e integração automática com o Apps Script.
- Aplicativo móvel nativo ou funcionamento offline.
- Multi-tenant ou integração direta com sistemas do TJMG.

## Requisitos não funcionais

| Requisito | Como o MVP atende |
| --- | --- |
| Simplicidade de operação | Node.js 24 + SQLite, sem dependências de runtime. |
| Segurança | `scrypt`, JWT + sessão, cookie HttpOnly, CSP, rate limit e validação. |
| Rastreabilidade | Timestamps, snapshots de documentos e exclusão lógica de chamados. |
| Responsividade | Layout próprio, validado em 1440 px e 390 px. |
| Portabilidade de banco | Acesso isolado em `server/db.js` e SQL padrão sempre que possível. |
| Testabilidade | Suíte `node:test` de API, configuração e frontend estático. |
| Documentação | `docs/producao/`, README, CHANGELOG e ADRs. |

## Critérios de sucesso do MVP

1. Um técnico consegue abrir um chamado, adicionar equipamentos, registrar uma
   troca e gerar o rascunho do laudo sem sair do console.
2. Um supervisor consegue localizar chamados por status, comarca, período e
   busca textual.
3. Nenhuma rota de dados fica acessível sem sessão válida.
4. O sistema sobe em um ambiente limpo com `npm run setup` e `npm run dev`.
5. A suíte automatizada passa integralmente.

## Estado atual

| Item | Estado |
| --- | --- |
| API, banco, autenticação e frontend | ✅ implementados e testados localmente |
| Fluxos de chamado/equipamento/troca/documento | ✅ validados pela interface |
| Perfil e troca de senha | ✅ implementados |
| Laudo/Romaneio A4 | ✅ no gerador oficial validado; ❌ não portado para o console |
| Hospedagem | ⏳ provedor não definido |
| Logos oficiais | ⏳ pendentes |
| Restrição do Apps Script ao domínio TJMG | ⏳ ação externa pendente |

Consulte o [roadmap](09-roadmap.md) para a sequência recomendada.
