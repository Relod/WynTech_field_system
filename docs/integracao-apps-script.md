# Integração com o gerador oficial do Laudo (Google Apps Script)

**Versão:** 0.7.0 · **Atualizado em:** 19/10/2026

Este documento descreve o que foi implementado no protótipo para aproveitar o
Web App oficial da Wyntech/TJMG, o que o script faz, por que não há uma chamada
direta de API e qual é o caminho para evoluir para prefill automático.

## 1. O que é o gerador oficial

O gerador é um Web App publicado em Google Apps Script. A implantação usada no
protótipo está configurada em:

```js
// prototipo/src/app.js
const OFFICIAL_LAUDO_URL = 'https://script.google.com/macros/s/.../exec';
```

O formulário oficial:

- consulta o ativo no **SIAD** (o “SSID” citado no atendimento) pela função
  `buscarAtivo`, via `google.script.run`;
- monta o **Laudo Técnico** com os dados do formulário, acessórios, checklist,
  avarias, observações e assinaturas;
- gera o **PDF no navegador** com `pdf-lib` e exibe a prévia com `pdf.js`;
- permite **arquivar uma cópia** no Google Drive pela função `salvarLaudo`;
- mantém um **rascunho local** no navegador e oferece **Baixar rascunho** e
  **Abrir rascunho** (importação de JSON).

O script **não retorna o PDF por uma API**: o PDF é produzido no cliente, no
contexto da página do Apps Script. O servidor cuida da consulta ao SIAD e do
arquivamento.

## 2. Por que não chamar o gerador diretamente do protótipo

Uma chamada `fetch`/POST do protótipo para o Web App não funciona sem alterar o
script, por três motivos:

1. O formulário usa `google.script.run`, um canal interno disponível apenas
   dentro da página servida pelo Apps Script.
2. A implantação atual não expõe um `doPost`/endpoint JSON com CORS para
   receber os dados do protótipo.
3. A página atual não lê parâmetros de URL para pré-preencher o formulário.

Além disso, o PDF é gerado no cliente. Mesmo que o protótipo conseguisse enviar
os dados, o script não devolveria um PDF pronto por uma chamada REST sem uma
nova implementação no servidor.

## 3. Ponte implementada: atalho + rascunho

A solução escolhida usa um recurso que o gerador já possui: **Abrir rascunho**.
Nenhuma alteração no Apps Script é necessária.

### 3.1 Onde fica

Na tela **Documentos**, painel **Gerador oficial do Laudo**:

- **Abrir gerador oficial** — abre o Web App em uma nova aba.
- **Rascunho do laudo** — baixa `Rascunho_Laudo_<patrimônio>.json`.
- **Rascunho do rollout** — baixa `Rascunho_Rollout_<patrimônio>.json`.

O painel também informa que o gerador é externo e exige internet, e que o PDF
local continua disponível offline.

### 3.2 Fluxo de uso

1. Preencha o atendimento no protótipo (chamado, equipamento, checklist,
   acessórios, fotos e fechamento).
2. Abra **Documentos** e clique em **Rascunho do laudo** ou **Rascunho do
   rollout**.
3. Clique em **Abrir gerador oficial**.
4. No gerador, clique em **Abrir rascunho** e selecione o JSON baixado.
5. Confira os dados. Se necessário, use **Consultar SIAD** para completar
   campos que o protótipo não possui. Os campos importados ficam marcados como
   “sujos” e não são sobrescritos pela consulta.
6. Clique em **Gerar Laudo** para baixar o PDF oficial e, se desejar, arquivar
   a cópia no Drive.

### 3.3 Contrato do rascunho

O arquivo segue exatamente o formato usado pelo gerador:

```json
{
  "versao": 1,
  "dados": {
    "comarcaAtendimento": "Pará de Minas",
    "patrimonio": "100309615",
    "tarefa": "TR1185398",
    "data": "2026-10-14",
    "movimento": "Devolução",
    "verificacao": "Edifício Goiás",
    "retirada": "Fórum de Pará de Minas / Vara Cível — Gabinete",
    "entrega": "Sala Polo Divinópolis",
    "serie": "PF39X109",
    "modelo": "Notebook DCM4A-4",
    "fabricante": "DATEN",
    "outros": "Pasta de transporte executiva",
    "justificativa": "Substituição de notebook por término de contrato e rollout institucional do magistrado.",
    "outroItem": "Pasta de transporte executiva",
    "avarias": "Não",
    "quais": "",
    "observacoes": "Equipamento funcional, limpo e em bom estado de conservação.",
    "destino": "Estoque",
    "comarca": "Pará de Minas",
    "a0": true,
    "a1": true,
    "a2": true,
    "a3": true,
    "a4": false,
    "a5": true,
    "c0": "Bom",
    "c1": "Bom",
    "c2": "Bom",
    "c3": "Bom",
    "c4": "Bom",
    "c5": "Bom"
  }
}
```

O importador oficial chama `fill(dados)`, que percorre os elementos do
formulário e aplica `value`/`checked` pelo atributo `name`. Campos extras são
ignorados. O importador também marca os campos como editados e define
`lastLookup` com o patrimônio, evitando que a consulta ao SIAD sobrescreva o
rascunho.

### 3.4 Mapeamento dos campos

| Campo no rascunho | Origem no protótipo | Regra |
|---|---|---|
| `comarcaAtendimento` | `state.call.comarca` | Deve existir na lista oficial de comarcas. |
| `patrimonio` | `state.call.patrS` | Patrimônio do equipamento que está sendo movimentado. |
| `tarefa` | `state.call.os` | OS/tarefa/incidente. |
| `data` | `state.call.data` | Convertida de `DD/MM/AAAA` para `AAAA-MM-DD`. |
| `movimento` | `movimentacao` | `MANUTENCAO` → Manutenção; demais → Devolução. Rollout → Devolução. |
| `verificacao` | `localVerif` | Local de verificação. |
| `retirada` | `localRetirada` + `setor` | Concatenados com ` / `. |
| `entrega` | `localEntrega` | Rollout usa `Sala Polo Divinópolis`. |
| `serie` | `serialS` | Número de série do equipamento retirado. |
| `modelo` | `modeloRetirado` | Modelo do equipamento retirado. |
| `fabricante` | `fabricanteRetirado` | Fabricante do equipamento retirado. |
| `outros` | `outros` | Texto de outros acessórios; exige `a5 = true`. |
| `justificativa` | `defeito` / texto de rollout | Justificativa do atendimento. |
| `outroItem` | `outros` | Item 6 do checklist (“Outro item relevante”). |
| `avarias` | `avaria` | `Sim` ou `Não`. |
| `quais` | `avariaDesc` | Descrição da avaria; obrigatória quando `Sim`. |
| `observacoes` | `obs` / texto de rollout | Observações gerais. |
| `destino` | `movimentacao` / rollout | Manutenção ou Estoque. |
| `comarca` | `comarca` / rollout | Comarca da Sala Polo; rollout usa Divinópolis. |
| `a0..a4` | `acessorios` | Normalização de maiúsculas/acentos; nomes oficiais. |
| `a5` | `outros` | Marcado se houver texto em outros. |
| `c0..c5` | `state.grades[1..6]` | `B` → Bom, `R` → Regular, `X` → Ruim. |

As regras de validação relevantes do gerador oficial são respeitadas:

- se `outros` tiver texto, `a5` precisa estar marcado; o rascunho já faz isso;
- se `avarias = "Não"`, `quais` deve ficar vazio; o rascunho já faz isso;
- se `avarias = "Sim"` e `quais` estiver vazio, o gerador pede a descrição antes
  de emitir; o rascunho deixa o campo para o técnico preencher, sem inventar
  texto.

### 3.5 Teste do contrato

O script [`scripts/verify-draft.js`](../scripts/verify-draft.js) extrai a
função `officialDraft()` do protótipo, gera os rascunhos de laudo e rollout com
os dados de demonstração e valida o formato e os campos esperados:

```bash
npm run verify:draft
```

O teste não chama a rede. Ele protege o contrato caso o mapeamento mude.

## 4. Próximo passo: prefill automático em um clique

Para abrir o gerador já preenchido, é necessário alterar o Apps Script. O
código do formulário já tem as funções `data()` e `fill()`; a alteração é
pequena, mas exige acesso ao projeto e nova publicação.

### Opção A — `doGet(e)` com rascunho na URL (recomendada para o piloto)

1. No `Code.gs`, ler um parâmetro na chamada `doGet(e)`, por exemplo
   `e.parameter.rascunho`.
2. Decodificar um JSON/base64 curto e passá-lo ao template:
   `template.draft = draft`.
3. No HTML, após o carregamento do formulário, chamar
   `fill(draft.dados)` e ajustar `dirty`/`lastLookup` como o importador faz.
4. No protótipo, montar a URL com o rascunho e abrir em nova aba.

Cuidados:

- JSON grande na URL pode estourar limites e fica no histórico/logs. Para dados
  reais, prefira um **token curto e temporário** (CacheService/Properties) em
  vez do JSON completo.
- Não coloque nomes, patrimônios ou outros dados pessoais em parâmetros de URL
  sem necessidade.
- Valide o formato e limite o tamanho no servidor.

### Opção B — iframe + `postMessage`

Incorporar o gerador em um modal e enviar o rascunho por `postMessage` exige:

- permitir o enquadramento (`XFrameOptionsMode.ALLOWALL` ou equivalente);
- adicionar um listener no HTML do Apps Script;
- tratar a origem e validar a mensagem.

O iframe mantém o usuário na mesma tela, mas mostra a interface do Google e
aumenta a superfície de segurança. Não é o caminho mais simples para o piloto.

### Opção C — API completa

Criar um `doPost` que receba os dados, consulte o SIAD e devolva o PDF exigiria
mover a geração do PDF para o servidor (ou usar um navegador headless). O
script atual gera o PDF no cliente; essa opção é mais pesada e não é
recomendada para o protótipo.

## 5. Segurança e LGPD

- A implantação usada no protótipo é um Web App do Google acessível por URL.
  Restrinja **Quem tem acesso** ao domínio TJMG/Google Workspace antes de usar
  dados reais.
- Revise o modo **Executar como**. Se o script executa como o proprietário,
  qualquer pessoa autorizada a abrir o Web App pode consultar o SIAD e
  arquivar no Drive com as credenciais dele. A restrição de acesso é
  obrigatória.
- O rascunho JSON contém os dados do atendimento. Trate-o como documento
  sensível; não o envie por canais informais.
- O protótipo não persiste nada fora do `localStorage`; o gerador oficial e o
  Drive estão fora do escopo de retenção do protótipo.
- A URL de implantação está no código. Se o repositório for público, trate a
  URL como exposta; restrinja/rotacione a implantação conforme a política do
  TJMG.

## 6. Referências

- `prototipo/src/app.js` — constante `OFFICIAL_LAUDO_URL`, funções
  `officialDraft()` e `downloadOfficialDraft()`.
- `scripts/verify-draft.js` — teste do contrato.
- `README.md` — visão geral e instruções de uso.
- `docs/conformidade-documental.md` — escopo dos documentos.
