# Arquitetura — Wyntech Campo TJMG

> **Versão:** 0.8.0 · **Atualizado em:** 19/10/2026  
> **Status:** MVP real funcional em ambiente local; hospedagem definida em VPS
> 1 GB Linux, com deploy pendente; integração externa do Apps Script ainda
> pendente.
>
> **Documento histórico:** o plano original PHP/MySQL foi preservado em
> [`docs/producao/historico/arquitetura-plano-php-mysql.md`](docs/producao/historico/arquitetura-plano-php-mysql.md).

Este documento resume a arquitetura vigente. Detalhes operacionais estão em
[`docs/producao/`](docs/producao/README.md).

## 1. Visão geral

O sistema é uma aplicação web monolítica, servida pelo próprio Node.js:

```text
┌──────────────────────────────────────────────────────────────┐
│ Navegador                                                    │
│  SPA em public/ · roteamento por hash · fetch com cookie     │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS/HTTP
┌───────────────────────────▼──────────────────────────────────┐
│ Node.js 24                                                   │
│  server/index.js                                             │
│    └── server/app.js                                         │
│          ├── cabeçalhos de segurança e arquivos estáticos    │
│          ├── autenticação (cookie/JWT + sessão no banco)     │
│          ├── roteador e tratamento de erros                  │
│          └── rotas /api/auth, /api/chamados, /api/dashboard  │
│                            │                                 │
│                            ▼                                 │
│   SQLite (node:sqlite)                                       │
│   dev: data/wyntech.sqlite · prod: /var/lib/wyntech/...      │
└──────────────────────────────────────────────────────────────┘

Atalho externo (opcional): Web App do Google Apps Script
  Laudo/Romaneio A4 validado · recebe rascunho JSON
```

Em produção, o Nginx termina o TLS no domínio pessoal e encaminha para
`127.0.0.1:3000`; o Node não fica exposto diretamente. O SQLite fica em
`/var/lib/wyntech` e o backup diário em `/var/backups/wyntech` (com cópia
externa). Detalhes em
[`docs/producao/12-deploy-vps-1gb.md`](docs/producao/12-deploy-vps-1gb.md).

Não há servidor de aplicação separado, bundler, framework frontend ou
dependências npm de runtime. O banco é acessado por SQL parametrizado e as
migrações são arquivos SQL versionados.

## 2. Componentes

| Caminho | Responsabilidade |
| --- | --- |
| `server/index.js` | Carrega configuração, abre o banco, inicia o servidor e trata desligamento. |
| `server/app.js` | Liga HTTP, autenticação, API e arquivos estáticos; aplica cabeçalhos de segurança. |
| `server/http.js` | Leitura de corpo com limite, JSON, erros, CORS opcional, estáticos e cabeçalhos. |
| `server/router.js` | Roteamento por método/caminho, parâmetros e rejeição de caminhos malformados. |
| `server/auth.js` | `scrypt`, JWT HS256, sessões persistidas, cookie HttpOnly e revogação. |
| `server/db.js` | Abertura do SQLite, `PRAGMA foreign_keys` e migrações; o backup lógico fica em `deploy/backup-wyntech.sh`. |
| `server/validation.js` | Validação de strings, inteiros, enums, datas e objetos. |
| `server/routes/` | Regras de autenticação, chamados, equipamentos, trocas, documentos, comarcas e dashboard. |
| `public/` | SPA sem framework; HTML, CSS e JavaScript servidos pelo mesmo domínio. |
| `scripts/` | Setup, migração, seed, reset e utilitários de verificação. |
| `tests/` | Integração da API, configuração e frontend estático. |
| `prototipo/` | Referência visual aprovada, templates A4 e contrato do rascunho. |

## 3. Fluxos principais

### Login

1. `POST /api/auth/login` valida e-mail/senha e o rate limit.
2. A senha é conferida com `scrypt` e comparação em tempo constante.
3. Uma sessão é criada em `sessoes` e um JWT HS256 é emitido.
4. O token é enviado em cookie `wyntech_session` (`HttpOnly`, `SameSite=Lax`,
   `Secure` em produção).
5. O frontend guarda apenas o usuário e a configuração pública em memória.

### Requisição autenticada

1. O navegador envia o cookie automaticamente.
2. O servidor valida assinatura, expiração, `jti`, sessão no banco e usuário ativo.
3. A rota aplica autorização: `ADMIN` acessa todos os chamados; `TECNICO`
   acessa somente os próprios.
4. A resposta segue o envelope `{ success, data, meta? }`.

### Documento

1. O técnico registra um snapshot (`LAUDO`, `LAUDO_ROLLOUT` ou `ROMANEIO`).
2. O snapshot fica em `documentos_gerados.dados_json`.
3. O botão **Baixar rascunho** gera `{versao:1,dados:{...}}` no navegador.
4. O botão **Gerador oficial** abre o Web App do Apps Script, que continua sendo
   a fonte validada do A4. O console não altera nem reimplementa o Apps Script.

## 4. Autenticação e autorização

- Senhas: `scrypt` com parâmetros explícitos, salt aleatório e hash em base64url.
- Token: JWT HS256 com `sub`, `jti`, `iat` e `exp`.
- Sessão: registro em `sessoes`; logout revoga o `jti`; troca de senha revoga as
  demais sessões do usuário e mantém a atual.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` conforme ambiente.
- Rate limit: por IP + e-mail, janela de 15 minutos, padrão de 5 tentativas.
- Papéis: `ADMIN` e `TECNICO`. Não há tela de administração de usuários no MVP.

## 5. Dados

O esquema está em
[`server/migrations/001_initial.sql`](server/migrations/001_initial.sql) e é
descrito em [`docs/producao/03-banco-de-dados.md`](docs/producao/03-banco-de-dados.md).

Entidades principais:

- `usuarios` — acesso, papel, cargo e estado ativo.
- `sessoes` — sessões emitidas, expiração e revogação.
- `comarcas` — unidades de atendimento.
- `chamados` — OS, tipo, comarca, contatos, defeito, solução e status.
- `equipamentos` — patrimônio, modelo, ação, movimentação e locais.
- `checklist_verificacao`, `acessorios` — extensões por equipamento (previstas
  para a evolução do laudo).
- `trocas` — vínculo entre equipamento retirado e instalado.
- `documentos_gerados` — snapshots de Laudo, Rollout e Romaneio.

Chamados usam exclusão lógica (`excluido_em`). O restante usa FKs com
`ON DELETE` coerente; equipamentos removidos deixam referências nulas em trocas.

## 6. Frontend

O frontend em `public/` é uma SPA sem framework, com rotas por hash:

`#/login` · `#/` · `#/chamados` · `#/chamados/novo` · `#/chamados/:id` ·
`#/perfil`

Ele reutiliza a linguagem visual do protótipo: sidebar escura, cabeçalho de
página com kicker, cards, badges de status, tabelas responsivas e bottom nav no
mobile. Não usa estilos inline, para manter a CSP `style-src 'self'`. Detalhes em
[`docs/producao/11-frontend.md`](docs/producao/11-frontend.md).

## 7. Segurança

- CSP sem `unsafe-inline`, `frame-ancestors 'none'`, `base-uri 'none'`.
- `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e
  `Permissions-Policy`.
- Limite de corpo, validação de caminho estático e erros sem stack trace.
- CORS desabilitado por padrão; quando configurado, restrito a uma origem.
- URL oficial validada para `script.google.com/macros/s/.../exec`.
- `AUTH_SECRET` obrigatório e com tamanho mínimo em produção.

O modelo de ameaças e a checklist de produção estão em
[`docs/producao/07-seguranca.md`](docs/producao/07-seguranca.md).

## 8. Decisões arquiteturais

| ADR | Decisão |
| --- | --- |
| [0001](docs/producao/adr/0001-nodejs-sqlite.md) | Node.js + SQLite sem dependências de runtime. |
| [0002](docs/producao/adr/0002-gerador-oficial-como-fonte-a4.md) | Gerador oficial é a fonte do A4 nesta versão. |
| [0003](docs/producao/adr/0003-sessao-cookie-httponly.md) | Sessão em cookie HttpOnly + JWT persistido. |
| [0004](docs/producao/adr/0004-vps-1gb-nginx.md) | VPS 1 GB Linux, domínio pessoal, Nginx/TLS e backup externo. |

## 9. Limites atuais e evolução

- O MVP foi validado localmente; a hospedagem definida é uma VPS Linux de 1 GB
  com disco persistente, swap e limite de memória. O deploy ainda não foi
  executado. Não há escala horizontal sem migração do SQLite.
- A VPS é pública e usa domínio pessoal; SSH, firewall, TLS, atualizações e
  backup externo são obrigatórios. O console não é uma publicação oficial do
  TJMG.
- O A4 local não foi portado; a impressão permanece no Apps Script validado.
- Não há upload de fotos/anexos, gestão de usuários, notificações ou integração
  automática com o Apps Script.
- O banco foi isolado atrás da camada de acesso para permitir uma futura
  migração para MySQL/PostgreSQL.
- O protótipo continua sendo a referência de design; qualquer alteração de
  layout deve ser comparada com `prototipo/index.html` e as capturas aprovadas.

## 10. Referências

- [README](README.md)
- [Documentação de produção](docs/producao/README.md)
- [API](docs/producao/04-api.md)
- [Operação](docs/producao/05-operacao.md)
- [Deploy](docs/producao/06-deploy-hospedagem.md)
- [Runbook da VPS 1 GB](docs/producao/12-deploy-vps-1gb.md)
- [Testes](docs/producao/08-testes.md)
- [Roadmap](docs/producao/09-roadmap.md)
