# 12 — Runbook da VPS 1 GB

> **Alvo:** VPS Linux de 1 GB (2 vCPU, 40 GB SSD), Ubuntu 24.04 LTS, acesso
> root/SSH, domínio pessoal. Plano informado: LocalWeb/Locaweb.
>
> **Natureza:** projeto pessoal, **não é uma publicação oficial do TJMG**. O
> console não usa domínio `tjmg.jus.br`.
>
> **Tempo estimado:** 60–90 minutos, mais a propagação do DNS.
>
> Este runbook complementa [06 — Deploy e hospedagem](06-deploy-hospedagem.md).
> Execute os blocos na ordem. Substitua os placeholders antes de rodar.

## 0. Antes de começar

Tenha em mãos:

- IP público da VPS e senha/console de acesso fornecidos pelo provedor;
- domínio pessoal (ex.: `seudominio.com.br`) e acesso ao DNS;
- e-mail para o Let's Encrypt;
- chave SSH local (ou gere uma nova);
- URL do Web App oficial do gerador, se já existir;
- snapshot inicial da VPS no painel do provedor.

Placeholders usados neste documento:

| Placeholder | Troque por |
| --- | --- |
| `IP_DA_VPS` | IPv4 da VPS |
| `campo.seudominio.com.br` | domínio pessoal do console |
| `SEU_EMAIL` | e-mail para o Certbot |
| `deploy` | usuário administrativo com sudo |
| `wyntech` | usuário de serviço, sem login |

> **Dados reais:** só coloque dados de atendimento do TJMG depois de confirmar
> autorização, retenção e armazenamento em infraestrutura particular com a área
> responsável. Para validar a instalação, use dados fictícios.

Se você for migrar o banco local para a VPS, copie o arquivo por um canal seguro
(`scp`/SFTP) e nunca o versione. Para um ambiente novo, o seed cria os usuários
e as comarcas.

## 1. Primeiro acesso e base do sistema

```bash
ssh root@IP_DA_VPS
```

Se o provedor entregar outro usuário inicial (por exemplo `ubuntu`), use-o com
`sudo` e adapte os comandos; o restante do runbook assume root.

Atualize o sistema e ajuste o fuso:

```bash
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade
apt-get install -y curl ca-certificates gnupg openssl nano dnsutils ufw fail2ban nginx git unzip htop jq certbot python3-certbot-nginx unattended-upgrades
timedatectl set-timezone America/Sao_Paulo
hostnamectl set-hostname wyntech
```

Habilite atualizações automáticas de segurança:

```bash
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
sudo systemctl enable --now unattended-upgrades
```

Confira:

```bash
timedatectl
systemctl is-active nginx
systemctl is-active unattended-upgrades
```

## 2. Swap e memória

O plano tem 1 GB de RAM. Crie 2 GB de swap para absorver picos e evitar OOM:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

sudo tee /etc/sysctl.d/99-wyntech.conf >/dev/null <<'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
sudo sysctl --system
```

Valide:

```bash
free -h
swapon --show
```

Swap é rede de segurança, não substituição de RAM. O serviço será limitado a
512 MB no systemd. Se `swapon` falhar, confirme com o provedor se o plano permite
swap; não prossiga sem essa proteção. Se houver swap intenso e reinícios por OOM,
migre para 2 GB.

## 3. Usuário administrativo, SSH e firewall

### 3.1 Criar o usuário `deploy`

```bash
adduser deploy
usermod -aG sudo deploy
```

Gere uma chave SSH **na sua máquina local**, se ainda não tiver:

```bash
ssh-keygen -t ed25519 -C "wyntech-vps"
```

Copie a chave para o servidor:

```bash
# Linux, macOS ou Git Bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy@IP_DA_VPS
```

No PowerShell do Windows, use:

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh deploy@IP_DA_VPS "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Teste **antes** de endurecer o SSH:

```bash
ssh deploy@IP_DA_VPS
sudo -v
```

Se a chave não funcionar, pare e use o console do provedor para corrigir. Não
desabilite a senha do root antes de confirmar que o acesso por chave funciona.

### 3.2 Endurecer o SSH

Crie um drop-in (mais seguro que editar o arquivo principal):

```bash
sudo tee /etc/ssh/sshd_config.d/99-wyntech.conf >/dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers deploy
EOF

sudo sshd -t
sudo systemctl reload ssh
```

Valide em uma **nova sessão**:

```bash
ssh deploy@IP_DA_VPS
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|allowusers'
```

Mantenha o console do provedor aberto como plano B até confirmar o acesso.

### 3.3 Firewall e fail2ban

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
```

Configure o fail2ban para SSH:

```bash
sudo tee /etc/fail2ban/jail.local >/dev/null <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF

sudo systemctl enable --now fail2ban
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd
```

> **Importante:** a porta 3000 não é liberada. O Node ficará em
> `127.0.0.1:3000` e somente o Nginx poderá acessá-lo.

## 4. Node.js 24

Instale pelo NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt-get install -y nodejs
```

Confirme a versão e o `node:sqlite`:

```bash
node -v
npm -v
node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE t (id INTEGER)'); console.log('node:sqlite ok'); db.close();"
```

`node -v` deve começar com `v24.`. Se o NodeSource instalar outra versão, pare
e revise a imagem do sistema antes de continuar.

## 5. Usuário de serviço, código e `.env`

Crie o usuário sem login e os diretórios:

```bash
id -u wyntech >/dev/null 2>&1 || sudo useradd --system --no-create-home --home-dir /opt/wyntech --shell /usr/sbin/nologin wyntech
sudo install -d -o wyntech -g wyntech -m 750 /opt/wyntech
sudo install -d -o wyntech -g wyntech -m 700 /var/lib/wyntech
sudo install -d -o wyntech -g wyntech -m 700 /var/backups/wyntech
```

Clone o repositório:

```bash
sudo -H -u wyntech git clone https://github.com/Relod/WynTech_field_system.git /opt/wyntech
```

Se o repositório for privado, configure uma deploy key para o usuário `wyntech`
antes do clone. Não use sua chave pessoal com permissão de push no servidor.

Crie o `.env`:

```bash
sudo -H -u wyntech cp /opt/wyntech/.env.example /opt/wyntech/.env
sudo -H -u wyntech chmod 600 /opt/wyntech/.env
sudo -H -u wyntech nano /opt/wyntech/.env
```

Gere os segredos localmente:

```bash
openssl rand -hex 32   # AUTH_SECRET (64 caracteres)
openssl rand -hex 16   # senha do seed (32 caracteres)
openssl rand -hex 16   # outra senha do seed
```

Conteúdo mínimo de produção (troque todos os placeholders):

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DB_PATH=/var/lib/wyntech/wyntech.sqlite

AUTH_SECRET=<64 caracteres hexadecimais>
TOKEN_TTL_SECONDS=43200
COOKIE_SECURE=true
TRUST_PROXY=true

OFFICIAL_LAUDO_URL=https://script.google.com/macros/s/SEU_DEPLOY/exec

SEED_ADMIN_EMAIL=admin@seudominio.com.br
SEED_ADMIN_PASSWORD=<senha forte>
SEED_TECNICO_EMAIL=tecnico@seudominio.com.br
SEED_TECNICO_PASSWORD=<senha forte>
```

Observações:

- `HOST=127.0.0.1` e `TRUST_PROXY=true` porque o Nginx está na mesma máquina.
- `COOKIE_SECURE=true` exige HTTPS. Não tente fazer login por HTTP: o cookie
  `Secure` não será enviado. Use `curl` no `/api/health` até o TLS estar pronto.
- `CORS_ORIGIN` deve ficar vazio; o frontend é same-origin.
- `OFFICIAL_LAUDO_URL` é opcional. Sem ela, o botão do gerador fica desabilitado.
  A URL deve ser exatamente `https://script.google.com/macros/s/.../exec`.
- Se você não usar o técnico de teste, desative-o depois do primeiro acesso; não
  deixe a senha padrão.

Confira permissões:

```bash
sudo ls -la /opt/wyntech/.env /var/lib/wyntech /var/backups/wyntech
```

## 6. Banco, migrações e seed

```bash
sudo -H -u wyntech bash -c 'cd /opt/wyntech && /usr/bin/npm run setup'
```

O comando aplica migrações, cria admin/técnico e as comarcas. Ele imprime as
credenciais iniciais definidas no `.env`; trate essa saída como sensível e
limpe o terminal/histórico depois.

Valide o banco e, se quiser, rode a suíte antes de subir o serviço:

```bash
sudo -u wyntech ls -la /var/lib/wyntech
sudo -H -u wyntech bash -c 'cd /opt/wyntech && /usr/bin/npm test'
sudo -H -u wyntech bash -c 'cd /opt/wyntech && /usr/bin/npm run verify:draft'
```

Não rode `npm run db:reset` na VPS: ele apaga o banco.

## 7. Serviço systemd

Instale o modelo pronto:

```bash
sudo cp /opt/wyntech/deploy/wyntech.service /etc/systemd/system/wyntech.service
sudo systemctl daemon-reload
sudo systemctl enable --now wyntech
sudo systemctl status --no-pager wyntech
```

Teste pela loopback:

```bash
curl -fsS http://127.0.0.1:3000/api/health | jq
ss -ltnp | grep 3000
```

O esperado é ver `127.0.0.1:3000`, nunca `0.0.0.0:3000`.

Verifique logs e memória:

```bash
sudo journalctl -u wyntech -n 100 --no-pager
systemctl show -p MemoryMax -p MemoryCurrent wyntech
```

O modelo usa `/usr/bin/node` (NodeSource), `MemoryMax=512M`,
`NODE_OPTIONS=--max-old-space-size=320` e isolamento do sistema de arquivos. Se
o Node estiver em outro caminho, ajuste `ExecStart` no arquivo antes de ativar.

## 8. Nginx e TLS

Confirme que o DNS já aponta para a VPS:

```bash
dig +short campo.seudominio.com.br
# ou: getent hosts campo.seudominio.com.br
```

Se não houver `dig`, instale `dnsutils` ou use `getent`. O resultado deve ser o
IPv4 da VPS.

Instale a configuração inicial:

```bash
sudo cp /opt/wyntech/deploy/nginx-wyntech.conf.example /etc/nginx/sites-available/wyntech
sudo sed -i 's/campo\.SEU_DOMINIO/campo.seudominio.com.br/g' /etc/nginx/sites-available/wyntech
sudo ln -sf /etc/nginx/sites-available/wyntech /etc/nginx/sites-enabled/wyntech
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Teste HTTP (o health não depende de cookie):

```bash
curl -fsS http://campo.seudominio.com.br/api/health | jq
```

Gere o certificado e ative o redirect:

```bash
sudo certbot --nginx \
  -d campo.seudominio.com.br \
  --redirect \
  --agree-tos \
  -m SEU_EMAIL \
  --no-eff-email
```

Valide:

```bash
curl -I http://campo.seudominio.com.br
curl -fsS https://campo.seudominio.com.br/api/health | jq
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

O `curl -I` HTTP deve redirecionar para HTTPS. A partir daqui, faça login pelo
navegador em `https://campo.seudominio.com.br` com as credenciais do seed e
troque as senhas em **Meu perfil**.

## 9. Backup e restauração

### 9.1 Instalar o backup

```bash
sudo install -o root -g wyntech -m 750 /opt/wyntech/deploy/backup-wyntech.sh /usr/local/sbin/wyntech-backup
sudo cp /opt/wyntech/deploy/wyntech-backup.service /etc/systemd/system/wyntech-backup.service
sudo cp /opt/wyntech/deploy/wyntech-backup.timer /etc/systemd/system/wyntech-backup.timer
sudo systemctl daemon-reload
sudo systemctl start wyntech-backup.service
sudo journalctl -u wyntech-backup.service -n 50 --no-pager
sudo ls -lh /var/backups/wyntech
```

O script usa `VACUUM INTO` (consistente com a aplicação rodando), comprime com
gzip, grava checksum e remove backups com mais de 30 dias.

Ative o timer diário:

```bash
sudo systemctl enable --now wyntech-backup.timer
systemctl list-timers wyntech-backup.timer
```

### 9.2 Testar a integridade

Substitua o nome do arquivo pelo backup mais recente e confira o checksum:

```bash
sudo -u wyntech bash -c 'cd /var/backups/wyntech && sha256sum -c wyntech-AAAAMMDDTHHMMSSZ.sqlite.gz.sha256'
```

Depois, teste a integridade:

```bash
sudo -u wyntech bash -c '
  gunzip -c /var/backups/wyntech/wyntech-AAAAMMDDTHHMMSSZ.sqlite.gz > /tmp/wyntech-check.sqlite
  /usr/bin/node -e "const {DatabaseSync}=require(\"node:sqlite\"); const db=new DatabaseSync(\"/tmp/wyntech-check.sqlite\"); console.log(db.prepare(\"PRAGMA integrity_check\").get()); console.log(db.prepare(\"SELECT COUNT(*) AS chamados FROM chamados\").get()); db.close();"
'
```

O resultado deve conter `integrity_check: "ok"`. Faça o teste em uma cópia; não
restaure sobre o banco em uso.

### 9.3 Restauração completa (janela de manutenção)

```bash
# Gere um backup lógico imediatamente antes de parar o serviço.
sudo systemctl start wyntech-backup.service

sudo systemctl stop wyntech
sudo -u wyntech gunzip -c /var/backups/wyntech/ARQUIVO.sqlite.gz > /var/lib/wyntech/wyntech.sqlite
sudo -u wyntech rm -f /var/lib/wyntech/wyntech.sqlite-wal /var/lib/wyntech/wyntech.sqlite-shm
sudo chown wyntech:wyntech /var/lib/wyntech/wyntech.sqlite
sudo chmod 600 /var/lib/wyntech/wyntech.sqlite
sudo systemctl start wyntech
curl -fsS https://campo.seudominio.com.br/api/health | jq
```

Depois, faça login e confira chamados/documentos. Se o restore falhar, mantenha
o serviço parado e use o backup gerado no início deste bloco.

### 9.4 Cópia externa

Backup no mesmo disco **não protege contra perda da VPS**. Configure uma das
opções:

- snapshot manual do provedor antes de atualizações (complemento, não
  substituto);
- `rclone` para storage externo;
- cópia criptografada para outro destino.

Para `rclone`, instale, configure como `wyntech` e teste:

```bash
sudo apt-get install -y rclone
sudo -H -u wyntech rclone config
sudo -H -u wyntech rclone lsd remote:
```

Depois, adicione ao serviço de backup um drop-in:

```bash
sudo systemctl edit wyntech-backup.service
```

```ini
[Service]
Environment=RCLONE_REMOTE=remote:wyntech-backups
```

O script envia o `.gz` e o checksum. Teste novamente com
`systemctl start wyntech-backup.service`.

## 10. Hardening final e monitoramento

Confira a exposição de portas:

```bash
sudo ss -tulpn | grep -E ':(22|80|443|3000)\b'
sudo ufw status verbose
sudo fail2ban-client status sshd
```

O Node deve aparecer em `127.0.0.1:3000`; Nginx em 80/443; SSH na porta
configurada.

Limite o journal para não consumir o disco:

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/99-wyntech.conf >/dev/null <<'EOF'
[Journal]
SystemMaxUse=200M
SystemMaxFileSize=50M
EOF
sudo systemctl restart systemd-journald
```

Monitore:

```bash
df -h
free -h
swapon --show
systemctl status wyntech --no-pager
sudo journalctl -u wyntech --since "24 hours ago" --no-pager
```

Recomendações:

- ative 2FA na conta do provedor e proteja o e-mail de recuperação;
- monitore `https://campo.seudominio.com.br/api/health` em serviço externo
  (o endpoint não expõe dados);
- revise `df -h` e `free -h` semanalmente;
- não instale Docker, MySQL ou painéis pesados nessa VPS de 1 GB;
- mantenha o console do provedor e o snapshot inicial disponíveis.

## 11. Atualizações e rollback

### 11.1 Atualizar

```bash
ssh deploy@IP_DA_VPS
sudo systemctl start wyntech-backup.service

sudo -H -u wyntech git -C /opt/wyntech fetch --all --prune
sudo -H -u wyntech git -C /opt/wyntech checkout main
sudo -H -u wyntech git -C /opt/wyntech pull --ff-only
sudo -H -u wyntech bash -c 'cd /opt/wyntech && /usr/bin/npm test'
sudo -H -u wyntech bash -c 'cd /opt/wyntech && /usr/bin/npm run db:migrate'

sudo systemctl restart wyntech
curl -fsS https://campo.seudominio.com.br/api/health | jq
sudo journalctl -u wyntech -n 50 --no-pager
```

O processo antigo continua atendendo enquanto o pull/teste/migração rodam; o
restart é o ponto de corte. Se o teste falhar, não reinicie.

### 11.2 Rollback

```bash
sudo systemctl stop wyntech
sudo -H -u wyntech git -C /opt/wyntech checkout <commit-ou-tag-anterior>
# Se a migração não for compatível, restaure o backup do banco:
# sudo -u wyntech gunzip -c /var/backups/wyntech/ARQUIVO.sqlite.gz > /var/lib/wyntech/wyntech.sqlite
sudo systemctl start wyntech
curl -fsS https://campo.seudominio.com.br/api/health | jq
```

Nunca use `npm run db:reset` em produção. Migrações devem ser compatíveis com a
versão anterior ou acompanhadas de backup/restauração.

### 11.3 Se os arquivos de `deploy/` mudarem

O código em `/opt/wyntech/deploy/` é atualizado pelo Git, mas as cópias em
`/etc/systemd/system` e `/usr/local/sbin` não são. Reinstale o que mudou:

```bash
sudo install -o root -g wyntech -m 750 /opt/wyntech/deploy/backup-wyntech.sh /usr/local/sbin/wyntech-backup
sudo cp /opt/wyntech/deploy/wyntech.service /etc/systemd/system/wyntech.service
sudo cp /opt/wyntech/deploy/wyntech-backup.service /etc/systemd/system/wyntech-backup.service
sudo cp /opt/wyntech/deploy/wyntech-backup.timer /etc/systemd/system/wyntech-backup.timer
sudo systemctl daemon-reload
sudo systemctl restart wyntech
```

Se a configuração do Nginx mudar, **não sobrescreva** o arquivo que o Certbot
gerenciou com o exemplo HTTP puro. Aplique a mudança manualmente em
`/etc/nginx/sites-available/wyntech`, preservando o bloco 443 e o redirect, e
valide antes de recarregar:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 12. Troubleshooting

| Sintoma | Causa provável | Ação |
| --- | --- | --- |
| `502 Bad Gateway` | Node parado ou em outra porta | `systemctl status wyntech`, `journalctl -u wyntech`, `ss -ltnp \| grep 3000`. |
| `403`/`404` no domínio | `server_name` errado ou DNS não propagou | Confira `dig`, o arquivo em `sites-enabled` e `nginx -t`. |
| Login não persiste | `COOKIE_SECURE=true` em HTTP ou TLS inválido | Use HTTPS; confira o certificado e o redirect. |
| `SQLITE_CANTOPEN` | Permissão ou caminho do banco | Confira `DB_PATH`, dono `wyntech` e modo `700` em `/var/lib/wyntech`. |
| `AUTH_SECRET é obrigatório` | `.env` não carregado | Confira `EnvironmentFile` e o conteúdo do `.env`. |
| `EADDRINUSE` | Processo antigo na porta 3000 | `ss -ltnp \| grep 3000`; encerre o processo antigo. |
| Serviço reinicia por OOM | Limite de memória/consumo | `journalctl -k`, `systemctl show -p MemoryCurrent`; aumente para 2 GB se necessário. |
| Certbot falha | DNS ou porta 80 bloqueada | Confira `dig`, UFW e `curl http://dominio`. |
| Disco cheio | Backups/logs antigos | `df -h`, `du -sh /var/backups/wyntech`, ajuste retenção. |
| Backup falha | Permissão ou `rclone` | `journalctl -u wyntech-backup`, confira dono do diretório e configuração do rclone. |
| Após update, 500 | Migração/código incompatível | Rollback de código e restauração do backup. |

## 13. Checklist final

- [ ] Acesso root por senha desabilitado; `deploy` entra por chave e usa sudo.
- [ ] UFW e fail2ban ativos; somente 22/80/443 expostos.
- [ ] Swap de 2 GB ativo; serviço limitado a 512 MB.
- [ ] Node 24 e `node:sqlite` validados.
- [ ] `.env` em `600`, banco em `700`, sem segredos no Git.
- [ ] Seed aplicado; senhas iniciais trocadas no primeiro login.
- [ ] `systemctl status wyntech` ativo; health via HTTPS.
- [ ] Nginx com TLS, redirect e renovação automática.
- [ ] Backup diário executado, checksum íntegro e restore testado.
- [ ] Cópia externa configurada.
- [ ] Apps Script restrito e URL oficial validada.
- [ ] Logs, disco e memória monitorados.
- [ ] Fluxos principais testados em desktop e celular.
- [ ] Política de dados/retenção definida; uso de dados reais autorizado.

O critério de go-live é a checklist de
[06 — Deploy](06-deploy-hospedagem.md#6-checklist-de-go-live) completa.
