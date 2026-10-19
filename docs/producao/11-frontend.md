# 11 — Frontend

## 1. Arquivos

| Arquivo | Papel |
| --- | --- |
| `public/index.html` | Shell: login, topbar, sidebar, view, bottom nav, toast e ícones SVG. |
| `public/app.js` | Estado, API, rotas, telas, formulários, ações e download do rascunho. |
| `public/styles.css` | Base visual compartilhada e componentes. |
| `public/mvp.css` | Ajustes do MVP real: painel, perfil, listas, responsividade. |

Não há bundler, framework ou dependência de CDN. O navegador carrega
`styles.css`, `mvp.css` e `app.js` diretamente. A CSP exige `style-src 'self'`;
**não use `style="..."` no HTML gerado**.

## 2. Rotas

| Hash | Tela | Acesso |
| --- | --- | --- |
| `#/login` | Login | público |
| `#/` | Painel | autenticado |
| `#/chamados` | Lista/filtros | autenticado |
| `#/chamados/novo` | Novo chamado | autenticado |
| `#/chamados/:id` | Detalhe, equipamentos, trocas, documentos | autenticado |
| `#/perfil` | Dados e troca de senha | autenticado |

O roteamento é por `hashchange`; não requer configuração de servidor. O título
do documento e o contexto da topbar são atualizados por tela.

## 3. Estado

```js
const state = {
  user: null,
  config: { officialLaudoUrl: '', version: '' },
  renderToken: 0,
  chamadoAtual: null,
};
```

- `user` e `config` vêm de `/api/auth/me` ou do login.
- `renderToken` evita que uma resposta atrasada sobrescreva a tela atual.
- `chamadoAtual` alimenta ações de documento/equipamento.
- Não há token em `localStorage`; a sessão é o cookie HttpOnly.

## 4. Fluxo de boot

1. `bootstrap()` chama `/api/auth/me`.
2. Se 200, aplica usuário/config e mostra o app.
3. Se 401 de sessão, mostra login sem alarme.
4. Se já autenticado, `renderRoute()` decide a tela pelo hash.
5. Login bem-sucedido limpa a senha, aplica sessão e navega para o painel.

O tratamento de 401 diferencia códigos de sessão de senha atual inválida:
`alterar-senha` com senha errada **não** desloga o usuário.

## 5. Camada de API

`api(path, { method, body })`:

- envia `Content-Type: application/json`;
- usa `credentials: 'same-origin'`;
- converte erros em `ApiError` com `message`, `status` e `code`;
- em 401 de sessão, limpa o estado e volta ao login;
- em falha de rede, mostra mensagem amigável.

Todas as respostas de sucesso usam `result.data`.

## 6. Telas

### Login

E-mail, senha, estado de carregamento, erro inline e dica de segurança. O
formulário é acessível por teclado e tem `autocomplete` adequado.

### Painel

- Saudação e resumo (total, em andamento, finalizados, hoje).
- Ações rápidas: atualizar e novo chamado.
- “Chamados recentes” e “Fluxo do atendimento”.
- No mobile, os cards empilham e a bottom nav aparece.

### Chamados

- Busca por OS/setor/contato/defeito.
- Filtros de status e tipo.
- Paginação e estado vazio.
- Tabela no desktop; cards no mobile.

### Novo chamado

- Comarca, OS, tipo, data, setor, contato, telefone e defeito.
- Validação no navegador + API.
- Após criar, abre o detalhe.

### Detalhe

- Dados do atendimento.
- Equipamentos com ação, movimentação e locais.
- Trocas vinculadas.
- Documentos com snapshot e ações Laudo/Rollout/Romaneio.
- Download do rascunho e atalho do gerador.
- Ações de status e exclusão.
- Responsável e timestamps.

### Perfil

- Dados do usuário, papel, cargo e data de criação.
- Troca de senha com confirmação e mínimo de 8 caracteres.
- Explicação da revogação das outras sessões.
- Versão da API, banco e estado do gerador.

## 7. Design system

A linguagem vem do protótipo aprovado:

- sidebar escura com marca, navegação e usuário;
- topbar compacta no mobile;
- eyebrows maiúsculos com traço;
- títulos grandes e lede em cinza;
- cards com borda fina e raio discreto;
- verde institucional para ação primária;
- badges de status com cor semântica;
- tabelas/listas densas, mas respiráveis;
- bottom nav fixa no mobile.

Use as classes existentes (`panel`, `panel-head`, `panel-body`, `btn`,
`btn-primary`, `badge`, `page-head`, `field`, `callout`, `empty-state`) antes de
criar novas.

## 8. Responsividade

- Sidebar fixa em telas maiores; topbar + bottom nav no mobile.
- Grids colapsam em breakpoints próximos de 1080, 900, 760, 560 e 400 px.
- Tabelas viram cards; ações permanecem visíveis.
- Formulários usam uma coluna no celular.
- Imagens/capturas finais: [`../capturas/mvp/`](../capturas/mvp/).

## 9. Acessibilidade

- Links e botões têm rótulos; ícones decorativos usam `aria-hidden`.
- Bottom nav possui `aria-label` em cada item.
- Foco visível em links/botões.
- Mensagens de erro ligadas ao formulário.
- Contraste alto na sidebar e nos botões primários.
- `aria-current`/estado visual na navegação quando aplicável.

Ainda faltam testes automatizados de acessibilidade (axe) e revisão com leitor de
tela; está no roadmap.

## 10. Segurança no frontend

- Todo dado dinâmico passa por `escapeHtml` antes de entrar no template.
- Não há `eval`, `new Function` ou script inline no frontend servido.
- Não há `localStorage` para sessão.
- Links externos usam `noopener noreferrer`.
- A URL oficial vem da API e é validada no servidor.
- Não adicione `style` inline; a CSP bloquearia.

## 11. Como adicionar uma tela

1. Adicione a rota em `renderRoute` e o item de navegação, se necessário.
2. Crie `renderNome(token, ...)` seguindo o padrão: buscar dados, checar
   `token !== state.renderToken`, montar HTML escapado, chamar `setView`.
3. Adicione ações em `handleViewClick`/`handleViewSubmit`.
4. Reaproveite componentes (`emptyState`, `badge`, `dataItem`).
5. Teste desktop e mobile, teclado, 401, estado vazio e erro de API.
6. Atualize esta documentação e as capturas se a mudança for visual.
