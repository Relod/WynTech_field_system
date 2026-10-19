# 04 — API

Base local: `http://127.0.0.1:3000`  
Formato: JSON UTF-8. Exceto `GET /api/health` e `POST /api/auth/login`, todas
as rotas exigem sessão.

## 1. Envelope e erros

Sucesso:

```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 0 }
}
```

Erro:

```json
{
  "success": false,
  "error": "Mensagem legível.",
  "code": "VALIDATION_ERROR",
  "details": { "field": "numero_os" }
}
```

Códigos usados:

| HTTP | Código | Quando ocorre |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Campo ausente, inválido ou nenhum campo para atualizar. |
| 400 | `INVALID_JSON` | Corpo não é JSON válido. |
| 400 | `INVALID_PATH` | Caminho percent-encoded malformado. |
| 400 | `REQUEST_ABORTED` | Cliente interrompeu o envio. |
| 401 | `UNAUTHENTICATED` | Sem cookie/Bearer. |
| 401 | `INVALID_CREDENTIALS` | Login ou senha atual incorretos. |
| 401 | `INVALID_TOKEN` / `EXPIRED_TOKEN` / `INVALID_SESSION` | Sessão inválida, expirada ou revogada. |
| 403 | `FORBIDDEN` | Ação restrita a administrador ou reatribuição indevida. |
| 404 | `NOT_FOUND` | Recurso/rota inexistente ou fora do escopo do usuário. |
| 413 | `PAYLOAD_TOO_LARGE` | Corpo acima do limite. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Corpo enviado sem `application/json`. |
| 429 | `TOO_MANY_ATTEMPTS` | Rate limit de login. |
| 500 | `INTERNAL_ERROR` | Erro inesperado, sem stack trace na resposta. |

## 2. Autenticação

### `POST /api/auth/login` (público)

```json
{ "email": "tecnico@wyntech.local", "senha": "Wyntech@2026" }
```

Resposta `200`:

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "expira_em": "2026-10-20T05:22:00.000Z",
    "usuario": {
      "id": 2,
      "nome": "Técnico de Campo",
      "email": "tecnico@wyntech.local",
      "matricula": "WYN-1044",
      "cargo": "Analista de Suporte",
      "papel": "TECNICO"
    },
    "config": {
      "officialLaudoUrl": "https://script.google.com/macros/s/.../exec",
      "version": "0.8.0"
    }
  }
}
```

Também envia `Set-Cookie: wyntech_session=...; HttpOnly; SameSite=Lax; Path=/`
(e `Secure` em produção). O frontend usa o cookie e não armazena o token. O
campo `token` existe para clientes de API que usam `Authorization: Bearer`.

### `POST /api/auth/logout`

Revoga a sessão atual, limpa o cookie e retorna `{ "ok": true }`.

### `GET /api/auth/me`

Retorna o usuário público e a configuração pública (`officialLaudoUrl`,
`version`). Usado no boot do frontend.

### `POST /api/auth/alterar-senha`

```json
{ "senha_atual": "Wyntech@2026", "nova_senha": "NovaSenha@2026" }
```

Regras: nova senha com pelo menos 8 caracteres e diferente da atual. Revoga
todas as outras sessões do usuário; a sessão atual continua válida. Retorna
`{ "ok": true }`.

## 3. Chamados

### `GET /api/chamados`

Query params opcionais:

| Parâmetro | Valores |
| --- | --- |
| `page` | inteiro >= 1 (padrão 1) |
| `limit` | inteiro 1..100 (padrão 20) |
| `tipo` | `IN`, `TR`, `REQ` |
| `status` | `ABERTO`, `EM_ANDAMENTO`, `FINALIZADO` |
| `comarca_id` | inteiro |
| `data_de`, `data_ate` | `AAAA-MM-DD` |
| `busca` | texto em OS, setor, contato ou defeito |

Técnicos recebem somente os próprios chamados; administradores recebem todos.
Resposta com lista em `data` e `meta {page, limit, total}`.

### `POST /api/chamados`

Campos obrigatórios:

```json
{
  "comarca_id": 3,
  "numero_os": "TR1185398",
  "tipo": "TR",
  "data_atendimento": "2026-10-19"
}
```

Opcionais: `setor`, `pessoa_contato`, `matricula_contato`, `telefone_contato`,
`defeito_relatado`, `solucao_aplicada`, `observacoes`, `status` (padrão
`ABERTO`). Administrador pode informar `usuario_id`; técnico sempre cria para si.
Retorna `201` com o chamado completo.

### `GET /api/chamados/:id`

Retorna o chamado com `equipamentos`, `trocas` e `documentos`. O técnico só
acessa os próprios; caso contrário, 404.

### `PUT /api/chamados/:id`

Atualização parcial. Aceita os mesmos campos e `status`. `usuario_id` só pode
ser alterado por administrador. Retorna o chamado completo.

### `DELETE /api/chamados/:id`

Exclusão lógica (`excluido_em`) e `204 No Content`.

## 4. Equipamentos

### `POST /api/chamados/:id/equipamentos`

```json
{
  "patrimonio": "100309615",
  "serial": "SN-001",
  "tipo_equipamento": "Desktop",
  "modelo": "OptiPlex",
  "fabricante": "Dell",
  "acao": "INSTALACAO",
  "tipo_movimentacao": "MANUTENCAO",
  "local_entrega": "Sala Polo Divinópolis"
}
```

`acao` é obrigatória: `VERIFICACAO`, `RETIRADA`, `INSTALACAO` ou `TROCA`.
`tipo_movimentacao` aceita `MANUTENCAO` ou `DEVOLUCAO`. Se `local_entrega` for
omitido, o padrão é `Sala Polo Divinópolis`. Retorna `201` com checklist e
acessórios vazios.

### `PUT /api/equipamentos/:id`

Atualização parcial dos mesmos campos. Retorna equipamento com `checklist` e
`acessorios`.

### `DELETE /api/equipamentos/:id`

Remove o equipamento e retorna `204`. Trocas que o referenciavam mantêm a troca
com referência nula.

## 5. Trocas

### `GET /api/chamados/:id/trocas`

Lista trocas do chamado com patrimônios/seriais/modelos dos equipamentos
retirado e instalado.

### `POST /api/chamados/:id/trocas`

```json
{
  "equip_retirado_id": 10,
  "equip_instalado_id": 11,
  "local_retirada": "Sala Polo",
  "local_entrega": "Sala Polo Divinópolis",
  "data_troca": "2026-10-19",
  "observacoes": "Substituição aprovada."
}
```

É obrigatório informar ao menos um dos equipamentos, e ambos devem pertencer ao
chamado. `data_troca` é validada como `AAAA-MM-DD`; se omitida, recebe o
timestamp atual. Retorna `201`.

## 6. Documentos

### `GET /api/chamados/:id/documentos`

Lista metadados e o snapshot (`dados`) de cada documento.

### `POST /api/chamados/:id/documentos`

```json
{
  "tipo_doc": "LAUDO",
  "dados": {
    "versao": 1,
    "dados": { "comarcaAtendimento": "Belo Horizonte" }
  }
}
```

`tipo_doc`: `LAUDO`, `LAUDO_ROLLOUT` ou `ROMANEIO`. `dados` é um objeto livre
(padrão `{}`) e é persistido como JSON. Retorna `201`.

## 7. Comarcas e dashboard

### `GET /api/comarcas`

Lista comarcas ativas, ordenadas por nome. `?todas=1` inclui inativas.
Requer autenticação.

### `GET /api/dashboard`

Resposta:

```json
{
  "success": true,
  "data": {
    "resumo": {
      "total": 1,
      "abertos": 0,
      "em_andamento": 1,
      "finalizados": 0,
      "hoje": 1
    },
    "recentes": [
      {
        "id": 1,
        "numero_os": "TR1185398",
        "tipo": "TR",
        "status": "EM_ANDAMENTO",
        "data_atendimento": "2026-10-19",
        "setor": "Sala Polo",
        "atualizado_em": "2026-10-19T17:31:00.000Z",
        "comarca_nome": "Belo Horizonte"
      }
    ]
  }
}
```

Administrador vê o consolidado global; técnico vê apenas os próprios chamados.

## 8. Health

### `GET /api/health` (público)

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "0.8.0",
    "database": "ok",
    "ambiente": "development"
  }
}
```

## 9. Exemplo rápido com cookie

```bash
curl -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"tecnico@wyntech.local","senha":"Wyntech@2026"}' \
  http://127.0.0.1:3000/api/auth/login

curl -b cookies.txt http://127.0.0.1:3000/api/dashboard
```

Para Bearer:

```bash
TOKEN="<token retornado no login>"
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3000/api/chamados
```

## 10. Observações de contrato

- A API não aceita campos desconhecidos como erro; eles são ignorados pela
  maioria dos handlers. Valide o cliente para evitar falsa sensação de sucesso.
- `dados` de documento é um snapshot opaco; a API não valida o schema do Laudo.
- Não há endpoint de atualização/exclusão de documentos nesta versão.
- `fotos` ainda não possui endpoint.
- A API não expõe o Apps Script diretamente; o link é apenas uma configuração
  pública autenticada.
