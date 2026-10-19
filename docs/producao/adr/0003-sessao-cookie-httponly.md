# ADR 0003 — Sessão em cookie HttpOnly + JWT persistido

- **Status:** aceito
- **Data:** 2026-10-19
- **Contexto:** O frontend é uma SPA servida pelo mesmo domínio da API. Era
  necessário evitar token em `localStorage`, permitir revogação e manter a API
  simples para clientes/testes.

## Decisão

Emitir JWT HS256 e também persistir a sessão na tabela `sessoes`. O navegador
recebe o token em cookie `HttpOnly`, `SameSite=Lax`, `Path=/` e `Secure` em
produção. A API aceita `Authorization: Bearer` para clientes não-browser.
Logout revoga o `jti`; troca de senha revoga as demais sessões.

## Motivos

- `HttpOnly` impede leitura do token por JavaScript.
- A tabela de sessões permite revogação imediata e auditoria básica.
- JWT evita consulta a cada requisição? **Não** — a sessão é validada no banco,
  priorizando revogação e simplicidade de escopo.
- O mesmo mecanismo serve à SPA e a testes/API.
- Não exige servidor de sessão externo.

## Consequências

Positivas:

- Sessão revogável sem esperar a expiração do JWT.
- Frontend não armazena token.
- Suporte a cookie e Bearer sem duplicar lógica.

Negativas:

- Toda requisição faz uma consulta à tabela `sessoes`.
- O token também aparece na resposta de login para clientes Bearer; o frontend
  não o armazena.
- Rotação de `AUTH_SECRET` invalida tokens e exige atenção operacional.
- CSRF residual deve ser mitigado por `SameSite`, same-origin e ausência de CORS.

## Alternativas consideradas

- **JWT stateless:** mais simples, mas sem revogação imediata.
- **Sessão opaca em cookie:** viável, exigiria menos crypto; o JWT foi mantido
  para interoperabilidade e testes.
- **Token em localStorage:** rejeitado por exposição a XSS.

## Critérios de revisão

Se houver múltiplas instâncias, considerar sessão compartilhada (Redis/banco
comum) ou JWT stateless com lista de revogação. Se surgir cliente cross-site,
adicionar proteção CSRF explícita.
