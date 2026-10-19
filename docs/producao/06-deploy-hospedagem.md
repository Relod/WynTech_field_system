# 06 — Deploy e hospedagem

> **Decisão de 19/10/2026:** publicar em uma **VPS Linux de 1 GB** (plano
> LocalWeb/Locaweb, 2 vCPU, 40 GB SSD), com acesso root/SSH e **domínio
> pessoal**, fora do domínio do TJMG. O deploy ainda não foi executado.
>
> O passo a passo operacional, com comandos e checklist, está em
> [12 — Runbook da VPS 1 GB](12-deploy-vps-1gb.md). Este documento registra a
> decisão, a capacidade e os critérios de go-live.
>
> A VPS é **auto-gerenciada**: o provedor entrega root/SSH e infraestrutura, não
> a aplicação pronta. O runbook assume esse modelo.

## 1. Por que o plano atende

| Recurso | Contratado | Avaliação para o MVP |
| --- | --- | --- |
| Memória | 1 GB | Suficiente para Node 24 + SQLite + Nginx com **swap de 2 GB**, heap limitado e sem Docker/MySQL no mesmo host. É o mínimo; monitorar e migrar para 2 GB se houver pressão sustained. |
| vCPU | 2 | Folgado para um único processo Node e volume baixo. |
| Disco | 40 GB SSD | Folgado para código, SQLite, logs e backups locais. Manter pelo menos 20% livre. |
| Rede | IPv4 público | Necessário para DNS e Let's Encrypt. Confirmar o IP no painel. |
| Acesso | root/SSH | Permite instalar Node 24, Nginx, Certbot e systemd. Exige hardening imediato. |
| Snapshot | 1 instantâneo | Útil antes de atualizações, **não substitui** backup lógico nem cópia externa. |

O sistema é leve: um processo Node, frontend estático e SQLite. A maior pressão
em 1 GB vem do sistema operacional, Nginx, picos de `npm`/testes e logs. Por
isso o runbook:

- cria **2 GB de swap** com `vm.swappiness=10`;
- limita o serviço a **512 MB** (`MemoryMax`) e o heap a **320 MB**;
- mantém Node escutando apenas em `127.0.0.1:3000`;
- não instala Docker, MySQL, PostgreSQL ou painel adicional.

Se o monitoramento mostrar uso de memória contínuo acima de ~70%, swap intenso
ou reinícios por OOM, o próximo passo é migrar para o plano de 2 GB — sem mudar
a arquitetura.

## 2. Requisitos obrigatórios

| Requisito | Como atender |
| --- | --- |
| Node.js **24+** | Instalar pelo NodeSource e confirmar `node -v`. |
| Processo persistente | systemd mantém o processo Node ativo. |
| Disco persistente | SQLite em `/var/lib/wyntech`; nunca em `/tmp` ou overlay efêmero. |
| HTTPS | Nginx + Certbot/Let's Encrypt no domínio pessoal. |
| Um único nó | SQLite não deve ser compartilhado entre réplicas. |
| Backup restaurável | Backup local diário + cópia externa + teste de restauração. |
| Acesso a logs | `journalctl` e logs do Nginx com rotação. |
| Hardening de borda | SSH por chave, root desabilitado, UFW e fail2ban. |

Se o provedor mudar para uma plataforma que só ofereça MySQL/PostgreSQL, será
necessário criar um adaptador de banco antes de publicar. Isso não está no MVP.

## 3. Topologia de produção

```text
Navegador
   │ HTTPS 443 (cookie Secure, HSTS)
   ▼
Nginx ──► 127.0.0.1:3000 (Node 24, systemd)
             │
             ▼
       SQLite em /var/lib/wyntech/wyntech.sqlite
             │
             └── backup diário em /var/backups/wyntech + cópia externa
```

- Firewall libera apenas **22, 80 e 443**.
- A porta **3000 não é aberta** no firewall; o Node fica em loopback.
- O domínio é pessoal (ex.: `campo.seudominio.com.br`), com registro DNS `A`
  apontando para o IPv4 da VPS.
- O Web App do Apps Script continua sendo um serviço Google separado.

## 4. Pacote de deploy

O repositório não tem dependências npm de runtime. O deploy leva:

```text
server/            # API
public/            # frontend
scripts/           # setup/migração/seed
deploy/            # systemd, Nginx e backup
data/.gitkeep      # diretório local do banco (não versionar o .sqlite)
package.json
.env.example
```

Não envie `.env`, `data/*.sqlite`, backups, `node_modules` ou capturas com dados
reais. O processo precisa de leitura no código e escrita apenas em
`/var/lib/wyntech`.

## 5. Nginx e TLS

O modelo inicial está em
[`deploy/nginx-wyntech.conf.example`](../../deploy/nginx-wyntech.conf.example).
Substitua `campo.SEU_DOMINIO` e rode:

```bash
sudo certbot --nginx -d campo.seudominio.com.br --redirect
```

O Certbot acrescenta o bloco 443 e o redirect HTTP → HTTPS. Depois:

- confirme `https://` com certificado válido;
- mantenha `COOKIE_SECURE=true`;
- use `TRUST_PROXY=true` **somente** atrás do Nginx;
- mantenha `HOST=127.0.0.1`;
- teste `certbot renew --dry-run`.

## 6. Checklist de go-live

- [ ] VPS criada com Ubuntu 24.04 LTS, IP e snapshot inicial anotados.
- [ ] DNS `A` do domínio pessoal aponta para a VPS e já propagou.
- [ ] SSH por chave; login de root e senha desabilitados.
- [ ] UFW ativo, liberando apenas 22/80/443; fail2ban ativo.
- [ ] Atualizações automáticas de segurança habilitadas.
- [ ] Swap de 2 GB ativo e `vm.swappiness=10`.
- [ ] Node 24 confirmado (`node -v` e teste de `node:sqlite`).
- [ ] Código em `/opt/wyntech`, usuário de serviço `wyntech` sem login.
- [ ] `.env` com permissão `600`; banco em `/var/lib/wyntech` com `700`.
- [ ] `AUTH_SECRET` aleatório com 64 caracteres; senhas do seed fortes.
- [ ] Senhas iniciais trocadas pela tela **Meu perfil**; técnico de teste
      desativado se não for usado.
- [ ] `NODE_ENV=production`, `HOST=127.0.0.1`, `COOKIE_SECURE=true` e
      `TRUST_PROXY=true`.
- [ ] Migrações e seed aplicados; `systemctl status wyntech` ativo.
- [ ] `/api/health` responde via HTTPS.
- [ ] Nginx com TLS válido, redirect e HSTS; `certbot renew --dry-run` passa.
- [ ] Backup diário agendado, primeira execução validada e **restauração
      testada** em cópia.
- [ ] Cópia externa do backup configurada (rclone, storage externo ou snapshot
      do provedor como complemento).
- [ ] `OFFICIAL_LAUDO_URL` configurada e validada; Apps Script restrito à conta
      ou ao domínio TJMG, conforme o caso.
- [ ] Logs sem segredos, com retenção e disco monitorado.
- [ ] Fluxos de login, chamado, equipamento, troca, documento e perfil testados
      em desktop e celular.
- [ ] Política de retenção/privacidade definida; se houver dados do TJMG,
      autorização e tratamento validados com a área responsável.

## 7. Atualização e rollback

Antes de atualizar, faça backup e teste a nova versão:

```bash
cd /opt/wyntech
sudo systemctl start wyntech-backup.service
sudo -H -u wyntech git fetch --all --prune
sudo -H -u wyntech git checkout main
sudo -H -u wyntech git pull --ff-only
sudo -H -u wyntech bash -c 'cd /opt/wyntech && /usr/bin/npm run db:migrate'
sudo systemctl restart wyntech
curl -fsS https://campo.seudominio.com.br/api/health
```

- Nunca execute `npm run db:reset` em produção.
- Migrações devem ser compatíveis com a versão anterior ou acompanhadas de
  plano de restauração.
- Rollback de código é possível com `git checkout <commit/tag>`.
- Se a migração não for reversível, restaure o backup do banco junto com o
  código anterior.
- Faça um snapshot do provedor antes de atualizações grandes do sistema
  operacional; ele não substitui o backup lógico.

## 8. Domínio, exposição e responsabilidade

- O console será publicado em **domínio pessoal**, não em domínio do TJMG. Isso
  não implica endosso ou publicação oficial do Tribunal.
- A VPS fica exposta à internet. A autenticação é o controle principal; para
  reduzir a superfície, avalie **Cloudflare Access**, **Tailscale/VPN** ou uma
  lista de IPs permitidos no UFW.
- Se for usar Cloudflare como proxy, restrinja a origem aos IPs da Cloudflare;
  caso contrário, o `X-Forwarded-For` pode ser falsificado e o rate limit de
  login perde eficácia.
- O Apps Script continua sujeito à conta Google e às regras de compartilhamento
  do TJMG. O domínio pessoal do console não concede acesso ao gerador.
- O fato de o domínio ser pessoal não altera a natureza dos dados. Se o console
  armazenar atendimentos, patrimônios ou dados pessoais do TJMG, confirme
  autorização de uso, retenção e armazenamento em infraestrutura particular com
  a área responsável. Sem essa definição, use apenas dados fictícios.

## 9. Se o provedor mudar

Os modelos em `deploy/` funcionam em qualquer VPS Linux com root/SSH. Antes de
contratar outro provedor, confirme por escrito:

1. versão exata do Node e suporte a `node:sqlite`;
2. processo contínuo, sem reinício a cada request;
3. disco persistente e local para o SQLite;
4. backup/restauração e snapshot;
5. limites de memória/CPU e política de OOM;
6. HTTPS, DNS e IP fixo;
7. política de logs e retenção.

Hospedagem compartilhada com Passenger/Node só deve ser considerada se cumprir
Node 24, processo contínuo e disco persistente. Caso contrário, o MVP não deve
ir para esse ambiente sem adaptação.

## 10. Referências

- [12 — Runbook da VPS 1 GB](12-deploy-vps-1gb.md)
- [05 — Operação](05-operacao.md)
- [07 — Segurança](07-seguranca.md)
- [10 — Integração com o gerador](10-integracao-gerador.md)
- [Modelos de deploy](../../deploy/README.md)
