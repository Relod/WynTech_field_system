# ADR 0001 — Node.js + SQLite sem dependências de runtime

- **Status:** aceito
- **Data:** 2026-10-19
- **Contexto:** MVP de baixo volume, ambiente Windows local sem PHP/Composer/
  Docker/MySQL e hospedagem ainda indefinida.

## Decisão

Implementar o sistema real em Node.js 24, usando apenas módulos nativos
(`node:http`, `node:sqlite`, `node:crypto`, `node:test`), com frontend estático
e SQLite em arquivo local. Não usar framework web, ORM ou dependências npm de
runtime.

## Motivos

- Instalação simples: `npm run setup` e `npm run dev`, sem build.
- Menor superfície de supply chain e auditoria.
- SQLite é suficiente para um único nó e volume pequeno.
- `node:sqlite` elimina driver externo.
- Facilita operar em máquina modesta e manter o foco no fluxo de campo.
- O banco fica isolado em `server/db.js`, permitindo migração futura.

## Consequências

Positivas:

- Deploy leve, sem `node_modules`.
- Testes rápidos e determinísticos.
- Controle total sobre roteamento, validação/SQL.

Negativas:

- Precisamos manter roteador, validação e autenticação.
- SQLite não escala horizontalmente e exige disco persistente.
- A hospedagem compartilhada precisa suportar Node 24; se não, será necessário
  adaptar.
- Não há ecossistema de middlewares prontos.

## Alternativas consideradas

- **PHP/MySQL:** plano original; ambiente local não tinha PHP e a operação seria
  mais pesada.
- **Express + better-sqlite3:** reduziria código, mas adicionaria dependências.
- **PostgreSQL:** mais robusto para múltiplas instâncias, porém excessivo para o
  estágio atual e sem servidor disponível.

## Critérios de revisão

Reavaliar se houver múltiplas instâncias, volume/concorrência acima do esperado,
necessidade de réplica ou hospedagem sem Node 24/disco persistente. Nesse caso,
priorizar PostgreSQL/MySQL e manter a API estável.
