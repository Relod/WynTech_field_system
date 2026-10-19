# 07 — Segurança

## 1. Modelo de ameaças resumido

Ativos: credenciais, sessões, chamados, equipamentos, documentos e o banco
SQLite. Ameaças principais: acesso indevido a chamados de outro técnico,
roubo de sessão, força bruta, XSS, CSRF, vazamento de segredos/URL oficial,
exposição do arquivo de banco e perda de dados.

O sistema é de uso pessoal, de baixo volume e será implantado em uma única VPS
Linux, exposta à internet em domínio pessoal. Não há MFA de aplicação, gestão de
usuários pela interface, WAF dedicado ou criptografia de campos. Como a VPS é
pública, SSH, firewall, atualizações do sistema e backup externo passam a fazer
parte do modelo de ameaças.

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

### Infraestrutura da VPS

- Acesso administrativo por chave SSH; login de root e autenticação por senha
  desabilitados.
- Usuário de serviço `wyntech` sem shell e sem sudo; código somente leitura no
  systemd.
- UFW libera apenas 22, 80 e 443; a porta 3000 fica em loopback.
- Nginx faz TLS com Let's Encrypt e redirect HTTP → HTTPS.
- fail2ban protege SSH; atualizações automáticas de segurança habilitadas.
- `MemoryMax=512M` e heap de 320 MB no plano de 1 GB, com 2 GB de swap.
- Backup diário com checksum e cópia externa ao disco da VPS.
- Snapshot do provedor é complemento, não substituto de backup lógico.

## 3. Riscos residuais e mitigações

| Risco | Situação | Mitigação recomendada |
| --- | --- | --- |
| Força bruta distribuída | rate limit em memória por processo | usar proxy/WAF e monitorar 429; reinício zera contadores. |
| CSRF | `SameSite=Lax` + JSON + API same-origin | manter CORS desligado; considerar token CSRF se surgir cliente cross-site. |
| XSS | CSP + escape manual | revisar qualquer nova interpolação; não usar `innerHTML` com dados brutos. |
| Sessão roubada | cookie HttpOnly | HTTPS obrigatório, rotação de segredo, expiração curta se necessário. |
| Segredo vazado | `.env` ignorado | rotação de `AUTH_SECRET` invalida tokens; revogar sessões no banco. |
| URL oficial exposta | entregue após login; não versionada | restringir compartilhamento do Apps Script à conta/domínio autorizado. |
| Banco copiado | arquivo local | permissões restritas, disco criptografado, backup seguro. |
| Perda de dados | nó único | backup testado, restore documentado e cópia externa. |
| Perda da VPS | disco único do provedor | snapshot + backup externo; testar restauração. |
| OOM em 1 GB | Node + Nginx + SO no mesmo host | `MemoryMax=512M`, heap de 320 MB, swap e monitoramento; migrar para 2 GB se necessário. |
| VPS pública | 80/443 expostos e SSH | TLS, UFW, fail2ban, updates, senhas fortes e, se possível, Cloudflare Access/VPN/IP allowlist. |
| Conta do provedor | acesso ao console/API | 2FA, e-mail seguro, chaves de API rotacionadas e mínimo de usuários administrativos. |
| Dados do TJMG em infra pessoal | armazenamento fora da rede do Tribunal | autorização, retenção e tratamento definidos com a área responsável; sem autorização, usar dados fictícios. |
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
- O `.env` da VPS deve ter modo `600`; chaves SSH e credenciais do provedor não
  podem ser copiadas para o repositório.
- Se a VPS ou a conta do provedor for comprometida, rotacione `AUTH_SECRET`,
  senhas, chaves SSH e credenciais de backup; revogue sessões e reconstrua o
  ambiente a partir de uma origem confiável.

## 5. Apps Script

O console apenas linka o Web App. A segurança real do gerador depende de:

1. acesso restrito à conta autorizada ou a “Qualquer pessoa dentro da
   organização TJMG”, conforme o caso;
2. revisão de “Executar como” (preferir o usuário que acessa, quando aplicável);
3. não expor o deployment como “Qualquer pessoa” na internet;
4. revisar quem pode editar o script e o Drive associado;
5. tratar o rascunho JSON como dado não confiável no importador.

A URL do Web App não é chamada pelo servidor; não há CORS nem token do console
sendo enviado ao Google. O domínio pessoal do console não altera as permissões
do Apps Script: o link é aberto na sessão Google do navegador e continua sujeito
ao compartilhamento configurado no script.

## 6. Checklist antes de dados reais

- [ ] `NODE_ENV=production`, HTTPS e `COOKIE_SECURE=true`.
- [ ] `AUTH_SECRET` forte e exclusivo.
- [ ] Senhas padrão trocadas; usuários de teste desativados.
- [ ] Apps Script restrito à conta/domínio autorizado; “Executar como” revisado.
- [ ] Banco e backups com permissão restrita.
- [ ] CORS desligado, salvo necessidade documentada.
- [ ] `TRUST_PROXY` coerente com a topologia (true apenas atrás do Nginx).
- [ ] SSH por chave, root/senha desabilitados, UFW e fail2ban ativos.
- [ ] Atualizações de segurança, swap e limite de memória configurados.
- [ ] Backup diário, checksum e restauração testados; cópia externa ativa.
- [ ] Conta do provedor com 2FA e credenciais protegidas.
- [ ] Logs sem dados sensíveis e com retenção definida.
- [ ] Teste de acesso cruzado entre técnicos.
- [ ] Política de retenção/LGPD definida; se houver dados do TJMG, validada com
      a área responsável.
- [ ] Plano de resposta a incidente e contato responsável.

## 7. Resposta a incidente

1. Preserve evidências (logs, banco, horário, IPs).
2. Revogue sessões (`UPDATE sessoes SET revogado_em=...`) e troque senhas.
3. Rotacione `AUTH_SECRET`, chaves SSH e credenciais de backup/provedor se houver
   suspeita de vazamento.
4. Restrinja o acesso de rede e o Web App oficial se necessário.
5. Se a VPS foi comprometida, prefira reconstruir a partir de uma imagem limpa e
   restaurar o banco de um backup íntegro, em vez de confiar no host atual.
6. Comunique o responsável e registre o ocorrido.
7. Corrija a causa e atualize este documento/testes.

Não há telefone ou canal de incidente definido no repositório; isso deve ser
preenchido pela operação antes do go-live.
