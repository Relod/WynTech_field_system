# Documentação de produção — Wyntech Campo TJMG

> **Versão:** 0.8.0 · **Atualizado em:** 19/10/2026  
> **Estado:** MVP real funcional localmente; hospedagem definida em VPS 1 GB
> Linux com domínio pessoal, deploy pendente. Logos oficiais e restrição externa
> do Apps Script ainda pendentes.

Esta pasta concentra a documentação do sistema real. O protótipo aprovado e os
documentos históricos continuam preservados em `prototipo/` e em
[`historico/`](historico/).

## Comece por aqui

| Documento | Quando usar |
| --- | --- |
| [01 — Visão geral](01-visao-geral.md) | Entender escopo, personas e o que está pronto. |
| [02 — Arquitetura](02-arquitetura.md) | Ver componentes, fluxos e decisões técnicas. |
| [03 — Banco de dados](03-banco-de-dados.md) | Consultar tabelas, relações e backup. |
| [04 — API](04-api.md) | Integrar ou depurar endpoints. |
| [05 — Operação](05-operacao.md) | Instalar, configurar, rodar e resolver problemas. |
| [06 — Deploy e hospedagem](06-deploy-hospedagem.md) | Entender a decisão, a capacidade e o go-live. |
| [07 — Segurança](07-seguranca.md) | Revisar riscos e checklist antes de dados reais. |
| [08 — Testes](08-testes.md) | Executar e interpretar a suíte. |
| [09 — Roadmap](09-roadmap.md) | Saber o que vem depois do MVP. |
| [10 — Integração com o gerador](10-integracao-gerador.md) | Laudo, Romaneio e rascunho JSON. |
| [11 — Frontend](11-frontend.md) | Navegar pelo código e manter a interface. |
| [12 — Runbook da VPS 1 GB](12-deploy-vps-1gb.md) | Instalar, publicar e operar na VPS contratada. |

## Decisões arquiteturais (ADRs)

- [0001 — Node.js + SQLite](adr/0001-nodejs-sqlite.md)
- [0002 — Gerador oficial como fonte do A4](adr/0002-gerador-oficial-como-fonte-a4.md)
- [0003 — Sessão em cookie HttpOnly](adr/0003-sessao-cookie-httponly.md)
- [0004 — VPS 1 GB Linux com Nginx e backup externo](adr/0004-vps-1gb-nginx.md)

## Documentos de referência do protótipo

- [`../conformidade-documental.md`](../conformidade-documental.md) — Laudo,
  Romaneio, campos e validação A4.
- [`../integracao-apps-script.md`](../integracao-apps-script.md) — contrato do
  rascunho e limites do Apps Script.
- [`historico/arquitetura-plano-php-mysql.md`](historico/arquitetura-plano-php-mysql.md)
  — plano original preservado, sem valor normativo para o MVP atual.

## Convenções

- Datas de negócio: `AAAA-MM-DD`; timestamps internos: ISO 8601 UTC.
- API: envelope `{success, data, meta?}`; erros com `success:false`, `error`,
  `code` e `details` opcional.
- Código e documentação em português; identificadores técnicos em inglês quando
  já consagrados (`token`, `cookie`, `payload`).
- Segredos nunca são versionados. `.env` e `data/*.sqlite` são ignorados.
