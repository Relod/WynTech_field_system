# 10 — Integração com o gerador oficial

## 1. Princípio

O **Web App do Google Apps Script** continua sendo a fonte validada do Laudo
Técnico Unificado e do Romaneio A4. O console não altera o Apps Script, não faz
`doPost`, não chama `google.script.run` e não tenta reproduzir o PDF oficial.

O console faz três coisas:

1. registra um snapshot do atendimento em `documentos_gerados`;
2. baixa um rascunho JSON compatível com “Abrir rascunho” do gerador;
3. oferece um atalho para o Web App, configurado no servidor.

## 2. Configuração do atalho

No `.env` do servidor:

```dotenv
OFFICIAL_LAUDO_URL=https://script.google.com/macros/s/SEU_DEPLOY_ID/exec
```

Regras de validação (`server/config.js`):

- HTTPS obrigatório;
- host exatamente `script.google.com`;
- caminho no formato `/macros/s/<id>/exec` (barra final opcional).

O servidor entrega `officialLaudoUrl` em `POST /api/auth/login` e
`GET /api/auth/me`, somente após autenticação. Sem a variável, o frontend mostra
o botão “Gerador não configurado”, desabilitado. A URL não fica hardcoded em
`public/`.

## 3. Contrato do rascunho

Formato:

```json
{
  "versao": 1,
  "dados": {
    "comarcaAtendimento": "Belo Horizonte",
    "patrimonio": "100309615",
    "tarefa": "TR1185398",
    "data": "2026-10-19",
    "movimento": "Devolução",
    "verificacao": "Sala Polo",
    "retirada": "Sala Polo",
    "entrega": "Sala Polo Divinópolis",
    "serie": "SN-001",
    "modelo": "OptiPlex",
    "fabricante": "Dell",
    "outros": "",
    "justificativa": "Equipamento não liga",
    "outroItem": "",
    "avarias": "Não",
    "quais": "",
    "observacoes": "Atendimento concluído.",
    "destino": "Estoque",
    "comarca": "Belo Horizonte",
    "a0": false,
    "a1": false,
    "a2": false,
    "a3": false,
    "a4": false,
    "a5": false,
    "c0": "Bom",
    "c1": "Bom",
    "c2": "Bom",
    "c3": "Bom",
    "c4": "Bom",
    "c5": "Bom"
  }
}
```

O importador oficial chama `fill(d.dados)`, por isso os nomes são exatamente os
do formulário do Apps Script — não os nomes internos da API.

### De onde vêm os campos

| Campo | Origem no MVP |
| --- | --- |
| `comarcaAtendimento` | `chamado.comarca_nome` |
| `patrimonio`, `serie`, `modelo`, `fabricante` | equipamento retirado (ou primeiro equipamento) |
| `tarefa` | `chamado.numero_os` |
| `data` | `chamado.data_atendimento` (ISO) |
| `movimento` / `destino` | `MANUTENCAO` → Manutenção; demais → Devolução/Estoque |
| `verificacao` | `equipamento.local_verificacao` |
| `retirada` | `local_retirada` + setor do chamado |
| `entrega` | `local_entrega` (padrão Sala Polo Divinópolis) |
| `justificativa` | `defeito_relatado` |
| `observacoes` | `observacoes` do chamado |
| `a0..a5` | **não capturados no MVP**; exportados como `false` |
| `c0..c5` | **não capturados no MVP**; exportados como `Bom` |

Acessórios e checklist devem ser conferidos no gerador antes de emitir o PDF.
A tela de documentos informa isso explicitamente. A evolução para capturar
esses campos está no [roadmap](09-roadmap.md).

## 4. Snapshot no banco

`POST /api/chamados/:id/documentos` grava:

```json
{
  "tipo_doc": "LAUDO",
  "dados": { "versao": 1, "dados": { "...": "..." } }
}
```

- `tipo_doc`: `LAUDO`, `LAUDO_ROLLOUT` ou `ROMANEIO`.
- O conteúdo é opaco para a API: não há validação do schema do Laudo.
- O snapshot preserva o que foi registrado, independentemente de alterações
  posteriores no chamado.
- Não há endpoint de atualização/exclusão de documento nesta versão.

## 5. Limitações conhecidas

- O Apps Script não expõe `doPost`/CORS; a integração é manual via “Abrir
  rascunho” e link.
- O console não gera o PDF nem o A4.
- O rascunho do MVP não inclui acessórios/checklist reais.
- O tipo do documento é registrado no snapshot, mas o rascunho baixado é o
  laudo padrão; o gerador decide o modelo final.
- O link depende de disponibilidade e permissão do Google.
- O Apps Script precisa ser publicado com acesso restrito ao domínio TJMG.

## 6. Segurança e governança

- Não versionar a URL real; ela fica no `.env` do servidor.
- Validar a URL evita que uma configuração errada vire um link malicioso.
- O link abre com `rel="noopener noreferrer"`.
- O gerador deve revisar “Executar como” e “Quem tem acesso”.
- O conteúdo do rascunho pode conter dados pessoais; trate o JSON como dado
  sensível.
- A planilha/Drive do Apps Script deve ter permissões compatíveis com a política
  do TJMG.

A especificação detalhada do protótipo está em
[`../integracao-apps-script.md`](../integracao-apps-script.md). O documento de
conformidade A4 está em
[`../conformidade-documental.md`](../conformidade-documental.md).
