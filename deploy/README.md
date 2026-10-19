# Deploy — VPS 1 GB Linux

Modelos usados pelo runbook
[`docs/producao/12-deploy-vps-1gb.md`](../docs/producao/12-deploy-vps-1gb.md).
Eles não contêm segredos e usam placeholders que devem ser substituídos no
servidor.

| Arquivo | Uso |
| --- | --- |
| `wyntech.service` | Unidade systemd do processo Node, com isolamento e limite de 512 MB. |
| `nginx-wyntech.conf.example` | Configuração HTTP inicial do Nginx; o Certbot acrescenta TLS e redirect. |
| `backup-wyntech.sh` | Backup lógico com `VACUUM INTO`, gzip, checksum e retenção. |
| `wyntech-backup.service` | Executa o backup como usuário `wyntech`. |
| `wyntech-backup.timer` | Agenda o backup diário às 03:15 (horário do servidor). |

## Premissas

- Ubuntu 24.04 LTS, Node 24 instalado em `/usr/bin/node` (NodeSource).
- Código em `/opt/wyntech`, usuário de serviço `wyntech`.
- Banco em `/var/lib/wyntech/wyntech.sqlite`.
- Backups em `/var/backups/wyntech`.
- Domínio pessoal, por exemplo `campo.seudominio.com.br`.
- Nginx na frente; Node escuta apenas `127.0.0.1:3000`.

## Instalação resumida

```bash
sudo cp deploy/wyntech.service /etc/systemd/system/wyntech.service
sudo systemctl daemon-reload
sudo systemctl enable --now wyntech

sudo cp deploy/nginx-wyntech.conf.example /etc/nginx/sites-available/wyntech
sudo ln -s /etc/nginx/sites-available/wyntech /etc/nginx/sites-enabled/wyntech
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d campo.SEU_DOMINIO --redirect

sudo install -o root -g wyntech -m 750 deploy/backup-wyntech.sh /usr/local/sbin/wyntech-backup
sudo cp deploy/wyntech-backup.service deploy/wyntech-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wyntech-backup.timer
```

Antes de executar, leia o runbook completo. Não copie `.env`, banco ou backups
para o Git. A ordem correta é: firewall e SSH → Node → banco/seed → systemd →
Nginx/TLS → backup → checklist de go-live.
