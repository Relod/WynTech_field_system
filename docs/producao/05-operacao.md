# 05 — Operação

## 1. Requisitos

- Node.js **24+** (testado com 24.22.0).
- npm (o projeto não tem dependências, mas os scripts npm são usados).
- Acesso de escrita em `data/` (SQLite) e em `.env`.
- Navegador moderno com suporte a `fetch`, `crypto.randomUUID` e ES2022.

Não são necessários PHP, Composer, Docker, MySQL ou instalação de pacotes npm.

## 2. Instalação local

```bash
git clone https://github.com/Relod/WynTech_field_system.git
cd WynTech_field_system
npm run setup
npm run dev
```

Saída esperada:

```text
Wyntech Campo TJMG v0.8.0
Ambiente: development
Servidor: http://127.0.0.1:3000
Banco: ...\data\wyntech.sqlite
```

Acesse `http://127.0.0.1:3000`.

### O que o `setup` faz

1. Cria `.env` com `AUTH_SECRET` aleatório **se o arquivo não existir**.
2. Abre/cria o SQLite em `DB_PATH`.
3. Aplica migrações pendentes.
4. Cria admin e técnico padrão e 8 comarcas (idempotente).
5. Não altera senhas de usuários já existentes.

## 3. Variáveis de ambiente

| Variável | Padrão | Obrigatória | Observação |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | não | `production` ativa validações e HSTS. |
| `HOST` | `127.0.0.1` | não | Mantenha `127.0.0.1` atrás do Nginx. Só use `0.0.0.0` se não houver proxy e o firewall proteger a porta. |
| `PORT` | `3000` | não | Inteiro 1..65535. |
| `DB_PATH` | `./data/wyntech.sqlite` | não | Absoluto ou relativo à raiz. |
| `AUTH_SECRET` | segredo de dev | **sim em produção** | Mínimo 32 caracteres. |
| `TOKEN_TTL_SECONDS` | `43200` | não | 12 horas. |
| `COOKIE_SECURE` | automático | em produção | `true` com HTTPS. |
| `OFFICIAL_LAUDO_URL` | vazio | não | Web App oficial; sem ela o botão fica desabilitado. |
| `TRUST_PROXY` | `false` | não | Só `true` atrás de proxy confiável. |
| `CORS_ORIGIN` | vazio | não | Se definido, libera apenas essa origem. |
| `LOGIN_RATE_LIMIT_MAX` | `5` | não | Tentativas por IP+e-mail em 15 min. |
| `MAX_BODY_BYTES` | `1000000` | não | Limite do corpo JSON. |
| `COOKIE_NAME` | `wyntech_session` | não | Alterar exige atualizar docs/testes. |
| `SEED_ADMIN_EMAIL` | `admin@wyntech.local` | não | Usado apenas na criação. |
| `SEED_ADMIN_PASSWORD` | `Wyntech@2026` | não | Troque antes de dados reais. |
| `SEED_TECNICO_EMAIL` | `tecnico@wyntech.local` | não | |
| `SEED_TECNICO_PASSWORD` | `Wyntech@2026` | não | Troque antes de dados reais. |

Exemplo mínimo de produção em VPS com Nginx:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DB_PATH=/var/lib/wyntech/wyntech.sqlite
AUTH_SECRET=<64 caracteres aleatórios>
COOKIE_SECURE=true
TRUST_PROXY=true
OFFICIAL_LAUDO_URL=https://script.google.com/macros/s/SEU_DEPLOY/exec
SEED_ADMIN_EMAIL=admin@dominio
SEED_ADMIN_PASSWORD=<senha forte>
SEED_TECNICO_EMAIL=tecnico@dominio
SEED_TECNICO_PASSWORD=<senha forte>
```

O roteiro completo da VPS de 1 GB está em
[12 — Runbook da VPS 1 GB](12-deploy-vps-1gb.md).

Gere o segredo com:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 4. Scripts

| Comando | Uso |
| --- | --- |
| `npm run setup` | Primeira execução e recuperação de migrações/seed. |
| `npm run dev` | Desenvolvimento com reinício automático. |
| `npm start` | Execução normal. |
| `npm run db:migrate` | Aplicar migrações sem seed. |
| `npm run db:seed` | Criar dados iniciais ausentes. |
| `npm run db:reset` | **Apaga** o banco local e recria. |
| `npm test` | Suíte completa. |
| `npm run build` | Regerar o protótipo autocontido. |
| `npm run preview` | Servir o protótipo. |
| `npm run verify:draft` | Validar o contrato do rascunho. |

## 5. Desenvolvimento

- `npm run dev` usa `node --watch`; alterações em `server/` reiniciam o processo.
- Alterações em `public/` são servidas sem reinício; recarregue o navegador.
- Alterações em `.env` exigem reinício.
- O banco local fica em `data/wyntech.sqlite` e é ignorado pelo Git.
- Para recomeçar do zero: `npm run db:reset` (destrutivo), depois `npm run dev`.
- Para testar o frontend, use o banco local com seed. `DB_PATH=:memory:` sobe
  sem dados e não serve para login real; os testes automatizados já criam o
  próprio banco em memória com seed.

## 6. Produção

1. Provisione Node 24 e um diretório persistente para o SQLite (na VPS de
   1 GB, crie também 2 GB de swap).
2. Crie o `.env` de produção com segredos fortes, `HOST=127.0.0.1` e
   `COOKIE_SECURE=true`.
3. Rode `npm run setup` (ou `db:migrate` + `db:seed`) uma vez.
4. Inicie com `npm start` sob o systemd, usando o modelo de `deploy/`.
5. Coloque Nginx com TLS na frente e mantenha a porta 3000 fechada.
6. Restrinja firewall (22/80/443) e desabilite root/senha no SSH.
7. Monitore `/api/health`, logs, disco e memória.
8. Faça backup do `.sqlite` antes de atualizações e mantenha cópia externa.

O modelo pronto está em
[`deploy/wyntech.service`](../../deploy/wyntech.service). Ele assume:

- Node em `/usr/bin/node` (instalação NodeSource);
- código em `/opt/wyntech`, usuário de serviço `wyntech`;
- banco em `/var/lib/wyntech/wyntech.sqlite`;
- `EnvironmentFile=/opt/wyntech/.env`;
- isolamento do sistema de arquivos e `MemoryMax=512M`, adequado ao plano de
  1 GB.

Instale e ative:

```bash
sudo cp deploy/wyntech.service /etc/systemd/system/wyntech.service
sudo systemctl daemon-reload
sudo systemctl enable --now wyntech
curl -fsS http://127.0.0.1:3000/api/health
```

O diretório do banco e o `.env` devem ter permissão restrita ao usuário do
serviço. Não execute como root. Ajuste `ExecStart` se o Node estiver em outro
caminho; o passo a passo da VPS está em
[12 — Runbook da VPS 1 GB](12-deploy-vps-1gb.md).

## 7. Backup e atualização

Na VPS, use o backup lógico com a aplicação rodando:

```bash
sudo systemctl start wyntech-backup.service
```

O script está em
[`deploy/backup-wyntech.sh`](../../deploy/backup-wyntech.sh), usa
`VACUUM INTO`, gera checksum e aplica retenção. O timer diário está em
[`deploy/wyntech-backup.timer`](../../deploy/wyntech-backup.timer). Para
detalhes de instalação e restauração, consulte
[12 — Runbook da VPS 1 GB](12-deploy-vps-1gb.md#9-backup-e-restauração).

No ambiente local, o equivalente é:

```bash
cp data/wyntech.sqlite backup/wyntech-$(date +%F).sqlite
```

Ou use `VACUUM INTO` (ver [03 — Banco de dados](03-banco-de-dados.md)). Depois
de atualizar:

```bash
npm run db:migrate
npm test
# reinicie o serviço
```

Mantenha pelo menos uma cópia externa e teste a restauração periodicamente.

## 8. Logs e diagnóstico

- O servidor imprime a configuração inicial (sem segredos) e erros não tratados
  no stderr.
- O proxy deve registrar status, latência e IP; evite registrar corpos com dados
  pessoais.
- `GET /api/health` verifica processo + banco.
- 401 em `/api/auth/me` no primeiro acesso é normal (frontend testa a sessão).
- 429 indica rate limit de login; aguarde a janela de 15 minutos.
- 500 com “Erro interno” deve ser investigado no stderr.

### Problemas comuns

| Sintoma | Causa provável | Ação |
| --- | --- | --- |
| `EADDRINUSE` | Porta 3000 ocupada | Encerre o processo ou mude `PORT`. |
| `AUTH_SECRET é obrigatório` | produção sem segredo | Defina `AUTH_SECRET` com 32+ caracteres. |
| Login sempre 401 | senha/seed diferente | Confira o usuário no banco ou recrie o ambiente. |
| `/api/health` ok, mas dados vazios | banco novo sem seed | `npm run db:seed`. |
| Sessão cai ao recarregar | `COOKIE_SECURE=true` em HTTP | Use HTTPS ou desligue em desenvolvimento. |
| Botão do gerador desabilitado | `OFFICIAL_LAUDO_URL` vazia/inválida | Configure a URL `.../exec` e reinicie. |
| Erro de banco em rede | SQLite em unidade de rede | Use disco local persistente. |

## 9. Segurança operacional

- Troque as senhas iniciais pela tela **Meu perfil** imediatamente.
- Remova ou desative usuários de teste antes de dados reais (não há tela de
  administração; faça via SQL com backup).
- Restrinja o Apps Script à conta/domínio autorizado e revise “Executar como”.
- Não versionar `.env`, banco, backups, logs ou capturas com dados reais.
- A URL oficial é configurada no servidor; não a coloque no frontend/repo.
- Na VPS, use SSH por chave, root desabilitado, UFW, fail2ban e atualizações
  automáticas. O Node deve escutar somente em `127.0.0.1`.
- Proteja a conta do provedor com 2FA e mantenha backup externo ao disco da VPS.

Consulte [07 — Segurança](07-seguranca.md),
[06 — Deploy e hospedagem](06-deploy-hospedagem.md) e
[12 — Runbook da VPS 1 GB](12-deploy-vps-1gb.md).
