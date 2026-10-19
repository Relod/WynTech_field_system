# 08 — Testes e validação

## 1. Executar

```bash
npm test
npm run verify:draft
```

Requisitos: Node 24+, banco em memória para os testes. A suíte usa
`node --test --test-concurrency=1`.

Resultado de referência em 19/10/2026:

```text
tests 25
pass 25
fail 0
```

## 2. O que é testado

### API (`tests/api.test.js`)

- Health público e banco acessível.
- Rotas protegidas exigem autenticação.
- Login inválido, mensagem uniforme e cookie não emitido.
- Rate limit bloqueia tentativas repetidas por IP/e-mail.
- Login válido, cookie HttpOnly e configuração pública.
- Sessão via Bearer e via cookie.
- Logout revoga sessão.
- Admin autentica e enxerga todos.
- Comarcas vindas do banco.
- Criação de chamado e validações de OS/data.
- Listagem, busca, filtros e paginação.
- Atualização de status/solução.
- Equipamentos: criação, atualização e acesso indevido.
- Trocas: vínculo, data inválida e equipamento de outro chamado.
- Documentos: registro e recuperação.
- Detalhe consolidado.
- Dashboard por escopo de usuário.
- Técnico não acessa chamado de outro.
- Exclusão lógica.
- Troca de senha: senha atual, mínimo, revogação das outras sessões.

### Configuração (`tests/config.test.js`)

- URL oficial só aceita `https://script.google.com/macros/s/.../exec`.
- Produção exige `AUTH_SECRET` com 32+ caracteres.
- Porta fora do intervalo é rejeitada.

### Frontend estático (`tests/static.test.js`)

- `index.html`, CSS e JS são servidos com Content-Type correto.
- CSP e cabeçalhos de segurança presentes.
- Rota inexistente 404.
- Caminho percent-encoded malformado retorna 400.
- Ausência de URL oficial hardcoded no frontend.

## 3. Contrato do rascunho

```bash
npm run verify:draft
```

Verifica se o exemplo de rascunho em `scripts/` mantém o formato
`{versao:1,dados:{...}}` e os campos esperados pelo importador oficial.

## 4. Validação manual realizada

Fluxos exercitados no navegador (Edge headless via CDP) em 19/10/2026:

- [x] Login com técnico e admin.
- [x] Painel com resumo e recentes.
- [x] Filtros por status, tipo, comarca e data.
- [x] Criação de chamado `TR-UI-001` e exclusão ao final.
- [x] Abertura do detalhe e adição do equipamento `100309617`.
- [x] Registro de troca e mudança para `EM_ANDAMENTO`.
- [x] Registro de laudo e download do rascunho JSON.
- [x] Abertura do gerador oficial (link configurado).
- [x] Perfil, senha atual incorreta e confirmação divergente.
- [x] Layout desktop (1440 px), mobile (390 px), teclado e foco.
- [x] Ausência de erros CSP no console (exceto 401 esperado no boot).

Capturas finais: [`../capturas/mvp/`](../capturas/mvp/).

## 5. Checklist antes de cada release

- [ ] `node --check public/app.js`
- [ ] `node --check prototipo/src/app.js` (se o protótipo mudou)
- [ ] `npm test`
- [ ] `npm run verify:draft`
- [ ] `npm run build` (se o protótipo mudou) e diff visual
- [ ] Teste de login/logout em desktop e mobile
- [ ] Teste de criação de chamado e documento
- [ ] Verificação de CSP no console do navegador
- [ ] Backup do banco e teste de `/api/health` no ambiente alvo

## 6. O que ainda não é automatizado

- Testes end-to-end de navegador (Playwright/Cypress).
- Testes de acessibilidade com axe.
- Testes de carga e concorrência do SQLite.
- Testes de restauração de backup.
- Validação automatizada do PDF/A4 (o gerador oficial é externo).

Esses itens estão no [roadmap](09-roadmap.md). Enquanto não houver E2E, a
checklist manual acima é obrigatória para mudanças de fluxo.
