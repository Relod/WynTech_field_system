# 07 — Segurança

## 1. Modelo de ameaças resumido

Ativos: credenciais, sessões, chamados, equipamentos, documentos e o banco
SQLite. Ameaças principais: acesso indevido a chamados de outro técnico,
roubo de sessão, força bruta, XSS, CSRF, vazamento de segredos/URL oficial,
exposição do arquivo de banco e perda de dados.

O sistema é interno, de baixo volume e implantado em um único nó. Não há
MFA, gestão de usuários pela interface, WAF dedicado ou criptografia de campos.

## 2. Controles implementados

### Credenciais

- `scrypt` com `N=16384`, `r=8`, `p=1`, salt de 16 bytes e chave de 64 bytes.
- Comparação em tempo constante (`timingSafeEqual`).
- Custo de hash executado também para e-mail inexistente, reduzindo enumeração.
- Mensagem uniforme de credenciais inválidas.
- Troca de senha exige a senha atual, mínimo de 8 caracteres e diferença da
  anterior; revoga as demais sessões.

### Sessão

- JWT HS256 assinado com `AUTH_SECRET`.
- Sessão persistida em `sessoes` com `jti`; logout e troca de senha revogam.
- Cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em produção.
- Token também pode ser usado via `Authorization: Bearer` para API/testes.
- Expiração padrão de 12 h; não há refresh token.

### Autorização

- `TECNICO` só acessa chamados, equipamentos, trocas e documentos do próprio
  chamado.
- `ADMIN` acessa todos.
- Acesso a recurso de outro usuário retorna 404 (não revela existência).
- Reatribuição de chamado é restrita a administrador.
- Rotas de API são autenticadas por padrão; apenas health e login são públicos.

### Entrada e saída

- SQL sempre parametrizado.
- Validação de tipos, tamanhos, enums, datas e objetos.
- `LIKE` com escape de curingas na busca.
- Corpo limitado a 1 MB por padrão.
- Frontend escapa HTML com `escapeHtml` antes de interpolar dados.
- CSP sem `unsafe-inline`, com `script-src 'self'`, `style-src 'self'`,
  `object-src 'none'`, `base-uri 'none'` e `frame-ancestors 'none'`.
- `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`,
  `Permissions-Policy` restritiva e HSTS em produção.
- Caminhos estáticos bloqueiam traversal, NUL e segmentos iniciados por ponto.
- Erros internos retornam mensagem genérica; stack trace fica no stderr.

### Abuso e disponibilidade

- Rate limit de login por IP+e-mail: 5 tentativas/15 min por padrão.
- Limite de corpo e leitura com abort handling.
- SQLite com `busy_timeout`, WAL e FKs ativas.
- Sem CORS por padrão; quando habilitado, uma única origem com credenciais.
- URL oficial validada para HTTPS em `script.google.com/macros/s/.../exec`.

## 3. Riscos residuais e mitigações

| Risco | Situação | Mitigação recomendada |
| --- | --- | --- |
| Força bruta distribuída | rate limit em memória por processo | usar proxy/WAF e monitorar 429; reinício zera contadores. |
| CSRF | `SameSite=Lax` + JSON + API same-origin | manter CORS desligado; considerar token CSRF se surgir cliente cross-site. |
| XSS | CSP + escape manual | revisar qualquer nova interpolação; não usar `innerHTML` com dados brutos. |
| Sessão roubada | cookie HttpOnly | HTTPS obrigatório, rotação de segredo, expiração curta se necessário. |
| Segredo vazado | `.env` ignorado | rotação de `AUTH_SECRET` invalida tokens; revogar sessões no banco. |
| URL oficial exposta | entregue após login; não versionada | restringir compartilhamento do Apps Script ao domínio TJMG. |
| Banco copiado | arquivo local | permissões restritas, disco criptografado, backup seguro. |
| Perda de dados | nó único | backup testado e restore documentado. |
| Usuário desligado | sem tela de admin | desativar via SQL (`ativo=0`) e revogar sessões. |
| Logs sensíveis | logs básicos | não logar corpos, tokens ou senhas; definir retenção. |

## 4. Segredos e rotação

- `AUTH_SECRET`: gere 32 bytes aleatórios; nunca reutilize entre ambientes.
- Trocar o segredo invalida todos os JWTs emitidos. Depois da troca, revogue as
  sessões antigas no banco ou aguarde a expiração.
- Senhas do seed devem ser trocadas no primeiro acesso. Se um ambiente já foi
  publicado com as senhas padrão, troque-as e audite os acessos.
- `OFFICIAL_LAUDO_URL` não é um segredo forte (qualquer usuário autenticado a
  vê), mas não deve ser publicada no repositório.
- Backups e `.env` não devem ir para o Git, artefatos de CI ou capturas.

## 5. Apps Script

O console apenas linka o Web App. A segurança real do gerador depende de:

1. acesso “Qualquer pessoa dentro da organização TJMG” (ou equivalente);
2. revisão de “Executar como” (preferir o usuário que acessa, quando aplicável);
3. não expor o deployment como “Qualquer pessoa” na internet;
4. revisar quem pode editar o script e o Drive associado;
5. tratar o rascunho JSON como dado não confiável no importador.

A URL do Web App não é chamada pelo servidor; não há CORS nem token do console
sendo enviado ao Google.

## 6. Checklist antes de dados reais

- [ ] `NODE_ENV=production`, HTTPS e `COOKIE_SECURE=true`.
- [ ] `AUTH_SECRET` forte e exclusivo.
- [ ] Senhas padrão trocadas; usuários de teste desativados.
- [ ] Apps Script restrito ao domínio TJMG; “Executar como” revisado.
- [ ] Banco e backups com permissão restrita.
- [ ] CORS desligado, salvo necessidade documentada.
- [ ] `TRUST_PROXY` coerente com a topologia.
- [ ] Logs sem dados sensíveis e com retenção definida.
- [ ] Teste de acesso cruzado entre técnicos.
- [ ] Política de retenção/LGPD acordada com o TJMG.
- [ ] Plano de resposta a incidente e contato responsável.

## 7. Resposta a incidente

1. Preserve evidências (logs, banco, horário, IPs).
2. Revogue sessões (`UPDATE sessoes SET revogado_em=...`) e troque senhas.
3. Rotacione `AUTH_SECRET` se houver suspeita de vazamento.
4. Restrinja o acesso de rede e o Web App oficial se necessário.
5. Restaure o banco de um backup íntegro, se houver corrupção.
6. Comunique o responsável Wyntech/TJMG e registre o ocorrido.
7. Corrija a causa e atualize este documento/testes.

Não há telefone ou canal de incidente definido no repositório; isso deve ser
preenchido pela operação antes do go-live.
