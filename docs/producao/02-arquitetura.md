# 02 — Arquitetura detalhada

> Resumo executivo em [`../../architecture.md`](../../architecture.md).

## 1. Estilo arquitetural

Monólito HTTP em Node.js, com frontend estático servido pelo mesmo processo.
A separação é por responsabilidade, não por processo:

```text
public/  ──HTTP──►  server/http.js  ──►  server/router.js
                                              │
                   server/auth.js ◄───────────┤
                                              ▼
                                     server/routes/*.js
                                              │
                                              ▼
                                     server/db.js ──► SQLite
```

Vantagens para o contexto atual: uma única implantação, nenhuma dependência de
runtime, operação simples em máquina pequena e caminho claro para trocar o
banco. Limitação: o processo e o arquivo SQLite precisam de disco persistente e
não há escala horizontal sem migração.

## 2. Inicialização

`server/index.js`:

1. Carrega `server/config.js` com variáveis de ambiente.
2. Abre o SQLite e aplica `PRAGMA journal_mode = WAL`,
   `PRAGMA foreign_keys = ON` e `busy_timeout`.
3. Executa migrações pendentes de `server/migrations/`.
4. Cria o servidor HTTP com `server/app.js`.
5. Registra `SIGINT`/`SIGTERM` para fechar o servidor e o banco.

`server/app.js` cria o contexto por requisição (config, banco, usuário, sessão),
aplica cabeçalhos comuns, resolve arquivos estáticos e encaminha `/api/*` ao
roteador. Erros conhecidos usam `ApiError`; erros inesperados viram 500 sem
expor stack trace.

## 3. Camadas

### HTTP (`server/http.js`)

- Lê corpo com limite (`MAX_BODY_BYTES`, padrão 1 MB).
- Aceita JSON e responde JSON com `Cache-Control: no-store`.
- Aplica CORS somente se `CORS_ORIGIN` estiver configurado.
- Serve `public/` com `Content-Type` por extensão, `no-cache` e proteção contra
  traversal; caminhos percent-encoded inválidos retornam 400.
- Aplica CSP e cabeçalhos de segurança em todas as respostas.
- Em produção com HTTPS, adiciona HSTS.

### Roteador (`server/router.js`)

- Casa método + caminho, com parâmetros `:id`.
- Rejeita caminhos malformados com `INVALID_PATH`.
- Converte o retorno da rota em resposta; `{status, data}` é aceito.
- 404 padronizado para rota ausente.

### Autenticação (`server/auth.js`)

- `hashPassword`/`verifyPassword` com `scrypt` e comparação em tempo constante.
- JWT HS256 assinado com `AUTH_SECRET`, contendo `sub`, `jti`, `iat`, `exp`.
- Sessão persistida em `sessoes`; a validação consulta o banco a cada requisição.
- Cookie HttpOnly `wyntech_session`; também aceita `Authorization: Bearer` para
  integrações e testes.
- `revokeSession` no logout; `revokeAllUserSessions` na troca de senha.
- `publicUser` remove hash de senha antes de responder.

### Validação (`server/validation.js`)

Funções explícitas para strings, inteiros, enums, datas, listas e objetos.
Mensagens e `fields` são retornadas em `details`. Não há ORM nem validação
implícita do banco.

### Banco (`server/db.js`)

- Driver nativo `node:sqlite`.
- Migrações ordenadas por nome de arquivo e registradas em `_migracoes`.
- Backup por `VACUUM INTO` em `scripts/`/ferramentas operacionais.
- Testes usam `:memory:` e fecham o banco no `after`.

## 4. Fluxo de uma requisição

Exemplo: `GET /api/chamados/12`

1. `server/app.js` aplica cabeçalhos e identifica rota de API.
2. A autenticação lê o cookie/Bearer, valida o JWT e busca a sessão.
3. O roteador injeta `{db, user, params, config}` no handler.
4. O handler valida o id, busca o chamado respeitando o escopo do usuário e
   monta equipamentos, trocas e documentos.
5. A resposta sai como:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "numero_os": "TR1185398",
    "equipamentos": [],
    "trocas": [],
    "documentos": []
  }
}
```

## 5. Autorização

| Recurso | `ADMIN` | `TECNICO` |
| --- | --- | --- |
| Listar chamados | todos | somente `usuario_id` próprio |
| Ler/editar/excluir chamado | todos | somente próprio |
| Reatribuir chamado | sim | não (403) |
| Equipamentos/trocas/documentos | via chamado acessível | via chamado próprio |
| Comarcas | leitura | leitura |
| Dashboard | consolidado global | consolidado próprio |

Chamados excluídos usam `excluido_em` e não aparecem em listagens nem no
dashboard. Acesso indevido retorna 404 para não revelar a existência do recurso.

## 6. Sessão e CSRF

O cookie é `HttpOnly` e `SameSite=Lax`, o que reduz exposição a JavaScript e a
maioria dos CSRF em navegação cross-site. A API aceita JSON e não usa `GET` para
mutações. Para produção atrás de HTTPS, `COOKIE_SECURE=true` é obrigatório. Não
há endpoint de API exposto a terceiros; CORS fica desligado por padrão.

## 7. Configuração e ambientes

| Ambiente | `NODE_ENV` | Banco | Cookie seguro | Uso |
| --- | --- | --- | --- | --- |
| Desenvolvimento | `development` | arquivo local | opcional | `npm run dev` |
| Produção | `production` | arquivo persistente | obrigatório | `npm start` atrás de HTTPS |
| Testes | `test` (implícito) | `:memory:` | desligado | `npm test` |

O carregamento é feito uma vez por processo. Alterações em `.env` exigem
reinício. Produção falha rápido se `AUTH_SECRET` tiver menos de 32 caracteres.

## 8. Integração com o gerador oficial

O console não chama o Apps Script por HTTP; apenas:

1. registra um snapshot em `documentos_gerados`;
2. monta e baixa o JSON `{versao:1,dados:{...}}` no navegador;
3. oferece um link para o Web App validado.

Assim, não há CORS, `doPost` nem mudança no Apps Script. A URL vem de
`OFFICIAL_LAUDO_URL`, é validada e entregue ao frontend autenticado em
`/api/auth/login` e `/api/auth/me`. Sem a variável, o botão fica desabilitado.

## 9. Implantação

Topologia mínima:

```text
Internet/HTTPS
   │
Proxy reverso (TLS, limites, logs)
   │ 127.0.0.1:3000
Node.js 24 + SQLite em disco persistente
```

O processo não deve rodar como root. O diretório de dados precisa de permissão
de escrita apenas para o usuário do serviço. Backup do arquivo `.sqlite` deve
ser feito com a aplicação parada ou via `VACUUM INTO`; copiar WAL isolado não é
suficiente.

## 10. Decisões e trade-offs

- **Sem dependências:** reduz supply chain e instalação, mas exige implementar
  roteador, validação e autenticação.
- **SQLite:** excelente para um único nó e volume pequeno; não atende múltiplas
  instâncias sem replicação/arquivo compartilhado.
- **SPA sem framework:** mantém o bundle pequeno e fiel ao protótipo; exige
  disciplina manual de escape e acessibilidade.
- **Documento como snapshot:** preserva o que foi registrado, mesmo que o
  chamado mude depois; não substitui o PDF oficial.
- **A4 no Apps Script:** preserva a fidelidade já validada e evita duplicação;
  mantém dependência externa e exige revisão de acesso no Google.
