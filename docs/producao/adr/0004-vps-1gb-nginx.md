# ADR 0004 — VPS 1 GB Linux com Nginx, TLS e backup externo

- **Status:** aceito
- **Data:** 2026-10-19
- **Contexto:** o MVP Node.js 24 + SQLite precisa de processo persistente, disco
  local e HTTPS. A hospedagem anteriormente estava indefinida. O projeto é de
  uso pessoal, será publicado em domínio próprio e não usará domínio do TJMG.
- **Decisão:** publicar em uma VPS Linux de 1 GB (2 vCPU, 40 GB SSD), Ubuntu
  24.04 LTS, com systemd, Nginx, Certbot e SQLite em `/var/lib/wyntech`.
  O Node escuta apenas em `127.0.0.1:3000`; o backup é diário, com checksum e
  cópia externa.

## Motivos

- Atende Node 24, `node:sqlite` e disco persistente sem adaptar o código.
- Custo compatível com um projeto pessoal de baixo volume.
- Controle total sobre processo, banco, TLS e backup.
- Evita dependência de hospedagem compartilhada com versão de Node incerta.
- Mantém a possibilidade de migrar para 2 GB ou para PostgreSQL/MySQL no futuro.

## Consequências

Positivas:

- Deploy simples, sem Docker, banco gerenciado ou dependências de runtime.
- Domínio pessoal com TLS e redirect HTTP → HTTPS.
- Backup testável e independente do painel do provedor.

Negativas:

- A VPS é pública e exige hardening de SSH, firewall e atualizações.
- 1 GB é o mínimo: requer swap, limite de memória e monitoramento.
- Um único nó não escala horizontalmente; a indisponibilidade da VPS derruba o
  console.
- O snapshot do provedor não substitui backup lógico; é preciso manter cópia
  externa.
- Dados de atendimento do TJMG em infraestrutura pessoal exigem autorização e
  definição de retenção/LGPD com a área responsável.

## Alternativas consideradas

- **Hospedagem compartilhada com Node/Passenger:** rejeitada por incerteza de
  versão do Node, processo contínuo e disco persistente.
- **PaaS com volume:** viável, mas com custo e limites de disco/processo menos
  previsíveis para SQLite.
- **VPS 2 GB:** mais confortável; fica como próximo passo se houver pressão de
  memória ou crescimento de uso.
- **Docker/MySQL na mesma VPS:** rejeitado para não consumir a RAM disponível e
  manter a operação simples.

## Critérios de revisão

Reavaliar se houver falta de memória recorrente, necessidade de múltiplas
instâncias, aumento relevante de concorrência, exigência de alta disponibilidade
ou mudança nas regras de armazenamento dos dados. Nesses casos, priorizar mais
RAM, backup gerenciado e migração para PostgreSQL/MySQL.
