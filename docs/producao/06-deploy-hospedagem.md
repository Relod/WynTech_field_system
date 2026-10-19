# 06 — Deploy e hospedagem

> **A hospedagem ainda não foi escolhida.** Este documento define requisitos e
> uma checklist para validar qualquer provedor antes de publicar dados reais.

## 1. Requisitos obrigatórios

| Requisito | Por quê |
| --- | --- |
| Node.js **24+** | O código usa `node:sqlite` e `--env-file-if-exists`. |
| Processo Node persistente | O servidor é um processo HTTP contínuo, não serverless. |
| Disco persistente | O SQLite é um arquivo local e precisa sobreviver a deploys/reinícios. |
| HTTPS | Cookie de sessão e dados de campo exigem TLS. |
| Um único nó/instância | SQLite não deve ser compartilhado entre instâncias. |
| Backup restaurável | Banco, `.env` e documentos são críticos. |
| Acesso a logs | Diagnóstico de erros e auditoria básica. |

Se o provedor só oferecer MySQL/PostgreSQL, será necessário criar um adaptador
de banco (`server/db.js` e queries) antes de contratar. Isso não está no MVP.

## 2. Opções compatíveis

1. **VPS Linux** (recomendado para controle): Node 24 + systemd + Nginx +
   diretório `/var/lib/wyntech` com backup.
2. **PaaS com disco persistente** e runtime Node 24: validar volume montado,
   processo contínuo e backup.
3. **Hospedagem compartilhada com Passenger/Node**: só aceitar se a versão for
   24+, houver disco persistente e o processo não for reiniciado a cada request.

Evite:
- funções serverless sem disco persistente;
- ambientes somente leitura;
- Node 18/20/22 sem suporte a `node:sqlite` estável;
- cluster com múltiplas réplicas apontando para o mesmo SQLite;
- provedor que não permita restaurar o arquivo do banco.

## 3. Preparação do pacote

O repositório não tem dependências npm de runtime. Ainda assim, o deploy deve
levar:

```text
server/            # API
public/            # frontend
scripts/           # setup/migração/seed
data/.gitkeep      # diretório do banco (não versionar o .sqlite)
package.json
.env.example
```

Não envie `.env`, `data/*.sqlite`, backups, `node_modules` ou capturas com dados
reais. O processo precisa de acesso de leitura ao código e escrita apenas no
diretório do banco/logs.

## 4. Passo a passo em VPS

```bash
# usuário de serviço, sem root
sudo useradd --system --create-home --home-dir /opt/wyntech wyntech
sudo mkdir -p /var/lib/wyntech /opt/wyntech
sudo chown -R wyntech:wyntech /opt/wyntech /var/lib/wyntech

# código
sudo -u wyntech git clone <repo> /opt/wyntech
cd /opt/wyntech
sudo -u wyntech cp .env.example .env
sudo -u wyntech nano .env

# configuração de produção
# NODE_ENV=production
# HOST=127.0.0.1
# PORT=3000
# DB_PATH=/var/lib/wyntech/wyntech.sqlite
# AUTH_SECRET=<64 chars>
# COOKIE_SECURE=true
# TRUST_PROXY=true
# OFFICIAL_LAUDO_URL=https://script.google.com/macros/s/.../exec

sudo -u wyntech npm run setup
sudo -u wyntech npm test
```

Instale a unidade systemd de [05 — Operação](05-operacao.md), habilite e suba:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wyntech
curl http://127.0.0.1:3000/api/health
```

## 5. Nginx + TLS

Exemplo de proxy (ajuste domínio e caminhos):

```nginx
server {
    listen 443 ssl http2;
    server_name campo.exemplo.tjmg;

    ssl_certificate     /etc/letsencrypt/live/campo.exemplo.tjmg/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/campo.exemplo.tjmg/privkey.pem;

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Com proxy confiável, `TRUST_PROXY=true` faz o rate limit usar o IP real. **Não**
ative essa opção se o Node estiver exposto diretamente, pois o cliente poderia
falsificar `X-Forwarded-For`.

## 6. Checklist de go-live

- [ ] Node 24 confirmado no servidor.
- [ ] `AUTH_SECRET` aleatório com 32+ caracteres, fora do Git.
- [ ] `NODE_ENV=production` e `COOKIE_SECURE=true`.
- [ ] HTTPS válido e redirect HTTP → HTTPS.
- [ ] Senhas do seed trocadas; usuários de teste removidos/desativados.
- [ ] Banco em disco persistente, com permissão restrita.
- [ ] Backup automático testado e restauração documentada.
- [ ] `OFFICIAL_LAUDO_URL` configurada e validada.
- [ ] Apps Script restrito ao domínio TJMG e “Executar como” revisado.
- [ ] `/api/health` monitorado.
- [ ] Logs sem dados sensíveis e com rotação.
- [ ] Teste de login, chamado, equipamento, troca, documento e perfil em
      desktop e celular.
- [ ] Termos/aviso de privacidade e retenção definidos com o TJMG.

## 7. Atualização e rollback

Atualização:

```bash
cd /opt/wyntech
sudo -u wyntech git fetch --all
sudo -u wyntech git checkout main
sudo -u wyntech git pull --ff-only
sudo -u wyntech npm run db:migrate
sudo -u wyntech npm test
sudo systemctl restart wyntech
```

Antes de atualizar, faça backup do banco. Rollback de código é possível com
`git checkout <tag>`; rollback de migração não é automático. Por isso, migrações
devem ser compatíveis com a versão anterior ou acompanhadas de plano de
restauração.

## 8. Se o provedor for compartilhado

Confirme por escrito com o provedor:

1. versão exata do Node e disponibilidade de `node:sqlite`;
2. se o processo fica contínuo;
3. onde o banco pode ser gravado e se o diretório sobrevive a deploy;
4. como é feito backup/restauração;
5. limites de memória/CPU e timeout;
6. suporte a HTTPS e variáveis de ambiente;
7. política de logs.

Se qualquer resposta for “não”, o MVP não deve ir para esse ambiente sem
adaptação (por exemplo, MySQL/PostgreSQL e storage externo).

## 9. Domínio e acesso externo

- Use um subdomínio interno (ex.: `campo.wyntech...`) com certificado válido.
- Restrinja o acesso por VPN/rede TJMG se possível.
- O Web App oficial é um serviço Google separado; restringir a URL no console
  não substitui a configuração de compartilhamento do Apps Script.
- Não publique a URL oficial em repositório público; ela fica no `.env` do
  servidor.
