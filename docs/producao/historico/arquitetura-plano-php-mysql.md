# 🏗️ Wyntech TJMG — Documento de Arquitetura

> **DOCUMENTO HISTÓRICO — sem valor normativo para o MVP atual.**
>
> Plano original PHP/MySQL preservado para rastreabilidade. A arquitetura
> vigente está em [`../../../architecture.md`](../../../architecture.md).
>
> **Versão:** 0.7.0  
> **Última atualização:** 2026-10-19  
> **Status do projeto:** 🟢 Protótipo navegável + integração oficial; backend de produção pendente  
> **Autor:** Analista de Suporte TI — Wyntech / TJMG

---

## Índice

0. [Estado atual do protótipo (v0.7.0)](#0-estado-atual-do-protótipo-v070)
1. [Resumo do Projeto](#1-resumo-do-projeto)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Arquitetura do Sistema](#3-arquitetura-do-sistema)
4. [Estrutura de Pastas](#4-estrutura-de-pastas)
5. [Modelo de Dados](#5-modelo-de-dados)
6. [API — Endpoints](#6-api--endpoints)
7. [Telas e Navegação](#7-telas-e-navegação)
8. [Documentos Gerados (PDFs) vs Lembretes de Checklist](#8-documentos-gerados-pdfs-vs-lembretes-de-checklist)
9. [Regras de Negócio](#9-regras-de-negócio)
10. [Performance e Otimização](#10-performance-e-otimização)
11. [Segurança](#11-segurança)
12. [Status de Desenvolvimento](#12-status-de-desenvolvimento)
13. [Changelog](#13-changelog)
14. [Decisões Técnicas (ADRs)](#14-decisões-técnicas-adrs)
15. [Pendências e Dúvidas](#15-pendências-e-dúvidas)
16. [Referências](#16-referências)

---

## 0. Estado atual do protótipo (v0.7.0)

> **Leia esta seção antes das seções 2–12.** As seções seguintes descrevem o
> alvo de produção (PHP/MySQL, autenticação, PWA, backend de API). O que existe
> hoje no repositório é um **protótipo estático autocontido**, validado para
> desktop e mobile, com os documentos A4 e a ponte para o gerador oficial.
> Onde houver divergência, prevalecem esta seção, o `README.md` e os documentos
> em `docs/`.

### 0.1 O que está entregue

- **8 telas navegáveis** por hash: `#/workspace` (Painel), `#/chamado`,
  `#/equipamento`, `#/fechamento`, `#/rollout`, `#/pop030`, `#/documentos` e
  `#/historico`.
- **Desktop e mobile:** sidebar fixa acima de 900 px; abaixo disso, topbar e
  bottom nav. Os grids colapsam em 1080, 900, 760, 560 e 400 px.
- **Estado local:** `localStorage` na chave `wyntech.campo.v1`; não há backend,
  login, banco de dados ou envio de dados para servidor no protótipo.
- **Documentos A4:** Laudo Técnico Unificado v5.0 (atendimento e rollout) e
  Romaneio de Substituição, com modos Preenchido e Em branco.
- **Impressão/PDF local:** `window.print()` + CSS `@media print`; sem jsPDF e
  sem PDF falso. A folha é isolada e as cores são forçadas com
  `print-color-adjust: exact`.
- **Gerador oficial:** painel em Documentos com atalho para o Web App do Apps
  Script, download de rascunho do laudo/rollout e importação pelo recurso
  **Abrir rascunho** do próprio gerador.
- **Build:** `node prototipo/build.js` concatena `styles.css`, `body.html` e
  `app.js` em `prototipo/index.html` (arquivo único, ~204 KB, sem dependências
  de runtime).

### 0.2 Estrutura real

```text
.
├─ prototipo/
│  ├─ src/{styles.css, body.html, app.js}
│  ├─ build.js
│  └─ index.html          # gerado; não editar
├─ scripts/
│  ├─ serve.js            # preview local em 127.0.0.1:8766
│  └─ verify-draft.js     # teste do contrato do rascunho oficial
├─ docs/
│  ├─ capturas/           # evidências desktop/mobile
│  ├─ exemplos/           # PDFs A4 de validação
│  ├─ integracao-apps-script.md
│  └─ conformidade-documental.md
├─ README.md
├─ CHANGELOG.md
├─ package.json
└─ LICENSE
```

### 0.3 Documentos e impressão

- O Laudo segue o modelo PRINT 02 v5.0: cabeçalho, seções I–VII, rótulos em
  bloco, faixas cinza, checkboxes desenhados em CSS e assinaturas no pé da
  folha.
- O Romaneio segue o modelo PRINT 03, com cabeçalho TJMG/Wyntech, faixas de
  metadados, tabelas S/I, OBS ampliado e assinaturas.
- A validação de impressão gerou **5 PDFs, todos com 1 página A4**
  (594,96 × 841,92 pt): Laudo normal, Laudo de rollout, Laudo em branco,
  Romaneio preenchido e Romaneio em branco. Exemplos em `docs/exemplos/`.
- Os logos dos documentos ainda são **representações tipográficas/placeholder**;
  os arquivos oficiais devem ser aplicados na produção. Ver
  `docs/conformidade-documental.md` §4.6.

### 0.4 Integração com o gerador oficial

O Web App do Apps Script é externo, consulta o SIAD por `buscarAtivo`, gera o
PDF no cliente com `pdf-lib` e arquiva no Drive por `salvarLaudo`. Ele usa
`google.script.run` e não expõe `doPost`/CORS nem pré-preenchimento por URL.

A ponte implementada **não altera o script**:

1. o protótipo monta `{ versao: 1, dados: { ... } }` em `officialDraft()`;
2. o usuário baixa o JSON em **Rascunho do laudo/rollout**;
3. abre o gerador oficial pelo atalho e usa **Abrir rascunho**;
4. o gerador importa via `fill(dados)`, consulta o SIAD se necessário e emite o
   PDF oficial.

A URL fica em `OFFICIAL_LAUDO_URL` (`prototipo/src/app.js`). O contrato é
testado por `npm run verify:draft`. Detalhes, mapeamento de campos, limitações
e o caminho para prefill em um clique estão em
`docs/integracao-apps-script.md`.

### 0.5 Validação

- Capturas desktop e mobile das 8 telas em `docs/capturas/`.
- Laudo e Romaneio conferidos nos modos preenchido e em branco.
- Rascunho oficial validado contra os nomes/valores de campos do formulário
  oficial (`npm run verify:draft`).
- Impressão: 5 PDFs de 1 página A4, com fundos preservados mesmo sem a opção
  “Gráficos de plano de fundo”.
- Não há suíte E2E automatizada; a validação de UI foi manual e com capturas
  headless.

### 0.6 O que ainda é alvo de produção

Backend PHP/MySQL, autenticação, sincronização com HP/SIAD, PWA/IndexedDB,
compressão de fotos, aplicação dos logos oficiais e prefill automático do
gerador oficial. As seções 2–12 descrevem esse alvo; não confunda com o que já
está implementado no protótipo.

---

## 1. Resumo do Projeto

**Wyntech TJMG Field Service** é uma aplicação web para automatizar a documentação de campo de um analista de suporte TI volante que atende chamados em comarcas do TJMG (Tribunal de Justiça de Minas Gerais).

### O Sistema HP (HP Service Manager / HPSM do TJMG)

O HP é o ERP/ITSM oficial e obrigatório do Tribunal de Justiça de Minas Gerais. Todas as demandas chegam por ele e devem ser baixadas nele. No entanto, por ser um sistema corporativo desenhado para desktop:
- É lento e burocrático para manusear no celular em campo (em deslocamento entre comarcas, cartórios e fóruns).
- Não automatiza a geração de documentos físicos de transporte e laudos exigidos pelo tribunal.
- Exige preenchimento disperso em várias abas (`Movimentação Patrimonial`, `MNS`, assistente de fechamento, `RAT`).

#### Anatomia do HP Service Manager (Extraída das Telas Reais):
1. **Chamado vs Incidente:**
   - O solicitante abre um Chamado (ex: `CH3817588`).
   - O chamado gera um Incidente técnico designado ao analista volante (ex: `IN2376285`) ou uma Tarefa de Requisição (`TR`).
2. **Metas e SLAs (Aba MNS):**
   - O TJMG opera com acordos rigorosos (`SLA BASE TJMG - DNS - FIELD INTERIOR - 10H / 24H`).
   - Há um contador de **Próxima Expiração** com SLA ajustado que exige encerramento ágil.
3. **Dados do Solicitante e Localização:**
   - `Pessoa de Contato`: Matrícula do servidor (ex: `10316456`) e telefone de contato.
   - `Localização`: Código numérico de localidade (ex: `10471000100`), Cidade, Sigla do setor e Edificação.
4. **Assistente de Fechamento do Incidente (`Fechar Incidente`):**
   - `Subcategoria`: Suporte Técnico
   - `Área`: Funcionamento
   - **Códigos de Fechamento Oficiais do HP:**
     - `Resolvido (Instrução/Orientação/Erro de Categoria)`
     - `Resolvido (Reinstalação/Correção)` *(sistemas, formatação, drivers)*
     - `Resolvido (Troca IC)` *(Troca de Item de Configuração: componente ou máquina inteira)*
     - `Encaminhado para outro processo`
     - `Cancelado`
     - `Não Reproduzível`
   - `Solução`: Campo aberto onde o técnico deve colar o parecer técnico circunstanciado.
5. **Aba Movimentação Patrimonial:**
   - Lista os patrimônios envolvidos, tipo de movimentação (`Retirada`, `Inclusão`), marca, modelo e Catmas.
6. **RAT Oficial (Relatório de Atendimento Técnico):**
   - Documento padrão gerado no botão `[RAT]` do HP, contendo dados do chamado, equipamento, campos de atividades e **Checklist Técnico Oficial de 14 itens**.

---

### O Papel do Wyntech Field Tool

O Wyntech **NÃO** concorre com o HP e **NÃO** é um sistema de gestão de chamados.  
Ele é o **assistente e canivete suíço de campo do analista volante** (mobile-first, ultrarrápido, offline-first):
1. **Guia de Execução & Checklist:** Orienta o técnico para nunca esquecer um passo burocrático (ex: em troca de máquina, dispara o checklist obrigatório de rollout: Guia de Transferência, RAT_ROLLOUT, foto com chip/serial/patrimônio, Laudo de Rollout, Termo de Responsabilidade e Romaneio).
2. **Gerador de Mensagens do HP:** Monta o texto de solução padronizado com 1 toque para copiar e colar direto no assistente do HP.
3. **Gerador de Documentos Oficiais:** Produz a folha A4 pronta para impressão/assinatura — **exclusivamente** o Laudo Técnico Unificado (v5.0), o Laudo de Rollout (notebook antigo) e o Romaneio de Substituição/Transporte para a Sala Polo. No protótipo, a saída é HTML/CSS + `window.print()`; o PDF oficial com consulta ao SIAD é emitido pelo Web App do Apps Script (§0.4). Documentos externos do tribunal (RAT do HP, RAT_ROLLOUT, Guia de Transferência e Termo de Responsabilidade) **não** são gerados pelo Wyntech, mas são cobrados no checklist (§8.2).
4. **Arquivo & Banco de Dados Pessoal:** Guarda o histórico de atendimentos, matrículas de quem assinou, fotos dos números de série/patrimônio e dados dos equipamentos para consultas futuras e respaldo do analista.

### Tipos de Chamado no HP

| Sigla | Nome | Descrição | Tratamento no Wyntech |
|-------|------|-----------|------------------------|
| **IN** | Incidente | Impacta o trabalho do usuário (PC não liga, travamento, rede) | Fechamento normal (Orientação/Reinstalação) OU Fechamento com Troca de Máquina/IC |
| **TR** | Tarefa de Requisição | Mudança física, troca de ponto, adição de PC/periférico | Checklist de movimentação predial e remanejamento |
| **REQ** | Requisição | Solicitação geral de serviço/atendimento | Registro de atendimento e emissão dos documentos obrigatórios (Laudo Técnico/Romaneio quando aplicável) |

### Ambiente de Destino

- **Hosting compartilhado** (não VPS)
- PHP 8+ e MySQL/MariaDB disponíveis
- Sem acesso SSH root (limitações típicas de shared hosting)

---

## 2. Stack Tecnológica

> **Nota (protótipo v0.7.0):** a implementação atual é 100% vanilla e
> autocontida. As linhas marcadas como “alvo de produção” não estão no
> repositório; o protótipo roda com um único HTML e `localStorage`.

### Frontend

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| HTML5 | - | Estrutura semântica |
| CSS3 (Vanilla) | - | Design system, documentos A4, responsividade e impressão |
| JavaScript (Vanilla ES6+) | - | Estado, hash router, documentos e integração |
| localStorage | - | Persistência do protótipo (`wyntech.campo.v1`) |
| jsPDF | 2.x | Alvo de produção; **não usado no protótipo** (impressão via `window.print()`) |
| Compressor.js | 2.x | Alvo de produção; não usado no protótipo |
| Service Worker / IndexedDB | - | Alvo de produção (PWA/offline); o protótipo usa `localStorage` |

### Backend (alvo de produção — não implementado no protótipo)

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| PHP | 8.0+ | API REST leve |
| PDO | - | Acesso ao banco de dados |
| MySQL / MariaDB | 8.0+ / 10.x | Banco de dados relacional |

### Libs externas (alvo: CDN-free, servidas localmente)

| Lib | Tamanho | Justificativa | Estado no protótipo |
|-----|---------|---------------|---------------------|
| jsPDF | ~90KB min | Geração de PDF A4 client-side no alvo de produção | ⬜ Não usado. A folha A4 é HTML/CSS e a ação “Imprimir / Salvar PDF” usa `window.print()`. O PDF oficial com SIAD é gerado pelo Apps Script com `pdf-lib`. |
| Compressor.js | ~12KB min | Reduz fotos de 5MB → ~200KB | ⬜ Planejado; o protótipo lê fotos localmente sem compressão. |
| Fontes do sistema (UI) + Arial/Times nos documentos | 0 KB | Leveza, ausência de dependência externa e reprodução no impresso | ✅ Implementado. A produção pode self-hostar a fonte institucional. |
| Ícones SVG inline | ~2KB/ícone | Ícones leves, sob demanda | ✅ Implementado; sem emojis e sem biblioteca externa. |

**Bundle atual do protótipo: ~204 KB em um único HTML** (CSS ~42 KB, HTML ~73 KB, JS ~89 KB), sem dependências de runtime. O total com jsPDF/Compressor.js e o backend PHP/MySQL é o **alvo de produção**, não o que está no repositório.

---

## 3. Arquitetura do Sistema

### Arquitetura real do protótipo (v0.7.0)

```text
Navegador
  └─ prototipo/index.html (HTML + CSS + JS inline)
       ├─ estado em localStorage (wyntech.campo.v1)
       ├─ documentos A4 (HTML/CSS) → window.print()
       └─ nova aba → Web App Apps Script (opcional; internet)
                        ├─ buscarAtivo (SIAD)
                        ├─ PDF no cliente (pdf-lib)
                        └─ salvarLaudo (Drive)
```

O protótipo não tem servidor, banco, autenticação nem API própria. O único
serviço externo é o Web App oficial, aberto por atalho; a ponte é o rascunho
JSON. O diagrama abaixo é o **alvo de produção**.

### Diagrama de Alto Nível (alvo de produção)

```
┌─────────────────────────────────────────────────────────────┐
│                    NAVEGADOR (Cliente)                       │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│  │  Router   │  │  Pages   │  │  PDF Gen  │  │  Offline  │  │
│  │  SPA      │  │  (Views) │  │  (jsPDF)  │  │  (IDB+SW) │  │
│  └────┬─────┘  └────┬─────┘  └───────────┘  └─────┬─────┘  │
│       │              │                             │        │
│       └──────┬───────┘                             │        │
│              │                                     │        │
│         ┌────▼─────┐                          ┌────▼─────┐  │
│         │  api.js  │◄─── sync quando online ──│  db.js   │  │
│         │  (fetch) │                          │ (IndexedDB) │  │
│         └────┬─────┘                          └──────────┘  │
└──────────────┼──────────────────────────────────────────────┘
               │ HTTPS / JSON
┌──────────────▼──────────────────────────────────────────────┐
│                    SERVIDOR (Hosting)                        │
│                                                             │
│  ┌──────────────────┐   ┌────────────────┐                  │
│  │  API PHP (REST)  │──▶│  MySQL/MariaDB │                  │
│  │  /api/index.php  │   │                │                  │
│  └──────────────────┘   └────────────────┘                  │
│                                                             │
│  ┌──────────────────┐                                       │
│  │  /uploads/       │  Fotos comprimidas                    │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

### Padrão de Comunicação

```
Cliente ──── fetch('POST /api/chamados') ────▶ Servidor
Cliente ◀─── { status: 200, data: {...} }  ──── Servidor
```

- Toda comunicação via **JSON**
- Respostas seguem padrão: `{ success: bool, data: any, meta?: object, error?: string, code?: string }`
- Upload de imagens via `multipart/form-data`

---

## 4. Estrutura de Pastas

### 4.1 Estrutura real do protótipo (v0.7.0)

```text
.
├─ prototipo/
│  ├─ src/{styles.css, body.html, app.js}
│  ├─ build.js
│  └─ index.html          # gerado; não editar
├─ scripts/{serve.js, verify-draft.js}
├─ docs/{capturas, exemplos, integracao-apps-script.md, conformidade-documental.md}
├─ README.md
├─ CHANGELOG.md
├─ package.json
└─ LICENSE
```

### 4.2 Estrutura alvo de produção

> A árvore abaixo descreve o MVP de produção (PHP/MySQL, PWA, backend). Ela
> **não** corresponde aos arquivos atuais do protótipo; serve como plano.

```text
wyntech/
│
├── index.html                     # SPA entry point
├── manifest.json                  # PWA config
├── sw.js                          # Service Worker
├── architecture.md                # ESTE ARQUIVO
├── .htaccess                      # Rewrite rules + cache + gzip
│
├── css/
│   ├── variables.css              # Design tokens
│   ├── base.css                   # Reset + tipografia
│   ├── components.css             # UI components reutilizáveis
│   ├── layouts.css                # Grid + responsividade
│   ├── pages.css                  # Estilos por página
│   └── print.css                  # @media print + @page A4 (documentos 1:1)
│
├── js/
│   ├── app.js                     # Bootstrap + inicialização
│   ├── router.js                  # SPA router (hash-based)
│   ├── api.js                     # Módulo HTTP (fetch wrapper)
│   ├── auth.js                    # Autenticação (JWT)
│   ├── db.js                      # IndexedDB wrapper
│   ├── utils.js                   # Helpers diversos
│   ├── image-compressor.js        # Wrapper do Compressor.js
│   │
│   ├── pages/                     # Módulos por tela
│   │   ├── dashboard.js           # Workspace / atendimentos do dia
│   │   ├── chamado-form.js        # Passo 1 — dados do chamado
│   │   ├── equipamento-form.js    # Passo 2 — equipamento + checklist do laudo
│   │   ├── chamado-list.js        # Histórico
│   │   ├── chamado-detail.js      # Detalhe do chamado
│   │   ├── troca.js               # Fechamento IN e Rollout TR
│   │   ├── pop030.js              # Motor dos 14 scripts POP030
│   │   └── documentos.js          # Emissão/preview dos PDFs
│   │
│   └── templates/                 # Templates de geração PDF
│       ├── laudo-tecnico.js       # PRINT 02 — Laudo Técnico v5.0
│       ├── laudo-rollout.js       # PRINT 02 — Rollout do notebook antigo
│       └── romaneio.js            # PRINT 03 — Romaneio TJMG
│
├── api/                           # Backend PHP
│   ├── .htaccess                  # Rewrite para router PHP
│   ├── index.php                  # Router principal
│   ├── config.php                 # DB connection + env
│   ├── helpers.php                # Funções utilitárias
│   ├── auth.php                   # JWT middleware
│   │
│   ├── controllers/
│   │   ├── AuthController.php
│   │   ├── ChamadoController.php
│   │   ├── EquipamentoController.php
│   │   ├── TrocaController.php
│   │   ├── UploadController.php
│   │   ├── DocumentoController.php
│   │   └── ComarcaController.php
│   │
│   └── models/
│       ├── Usuario.php
│       ├── Chamado.php
│       ├── Equipamento.php
│       ├── Troca.php
│       ├── Documento.php
│       └── Comarca.php
│
├── uploads/                       # Fotos (protegido)
│   └── .htaccess
│
├── assets/
│   ├── icons/                     # PWA icons (192, 512)
│   ├── fonts/                     # Fontes institucionais self-hosted (definir na produção)
│   └── img/                       # Imagens estáticas
│
└── sql/
    ├── schema.sql                 # Criação das tabelas
    ├── seed.sql                   # Dados iniciais (comarcas, etc.)
    └── migrations/                # Alterações futuras no schema
        └── 001_initial.sql
```

### Convenções de Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Arquivos HTML/CSS/JS | kebab-case | `chamado-form.js` |
| Classes PHP | PascalCase | `ChamadoController.php` |
| Métodos PHP | camelCase | `findById()` |
| Funções JS | camelCase | `renderDashboard()` |
| Constantes | UPPER_SNAKE_CASE | `API_BASE_URL` |
| Tabelas DB | snake_case (plural) | `chamados`, `equipamentos` |
| Colunas DB | snake_case | `data_atendimento`, `criado_em` |
| Rotas API | kebab-case (plural) | `/api/chamados`, `/api/equipamentos` |

---

## 5. Modelo de Dados

### Tabelas

#### `usuarios`
| Coluna | Tipo | Restrição | Descrição |
|--------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | |
| nome | VARCHAR(100) | NOT NULL | |
| email | VARCHAR(150) | UNIQUE, NOT NULL | |
| senha_hash | VARCHAR(255) | NOT NULL | bcrypt hash |
| matricula | VARCHAR(20) | | Matrícula Wyntech |
| cargo | VARCHAR(50) | DEFAULT 'Técnico' | |
| criado_em | DATETIME | DEFAULT NOW() | |

#### `comarcas`
| Coluna | Tipo | Restrição | Descrição |
|--------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | |
| nome | VARCHAR(100) | NOT NULL | Ex: "Pará de Minas" |
| cidade | VARCHAR(100) | | |
| endereco | TEXT | | Endereço completo |
| ativa | BOOLEAN | DEFAULT TRUE | |

#### `chamados`
| Coluna | Tipo | Restrição | Descrição |
|--------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | |
| usuario_id | INT | FK → usuarios.id | Técnico responsável |
| comarca_id | INT | FK → comarcas.id | |
| numero_os | VARCHAR(30) | NOT NULL | Nº do chamado HP (ex: TR1185398) |
| tipo | ENUM('IN','TR','REQ') | NOT NULL | Incidente, Tarefa, Requisição |
| setor | VARCHAR(100) | | Setor do atendimento |
| pessoa_contato | VARCHAR(100) | | Nome do contato no local |
| matricula_contato | VARCHAR(20) | | Matrícula do servidor TJMG |
| telefone_contato | VARCHAR(30) | | Telefone / ramal |
| defeito_relatado | TEXT | | Descrição do problema |
| solucao_aplicada | TEXT | | O que foi feito |
| observacoes | TEXT | | Observações gerais |
| status | ENUM('ABERTO','EM_ANDAMENTO','FINALIZADO') | DEFAULT 'ABERTO' | |
| data_atendimento | DATE | NOT NULL | |
| criado_em | DATETIME | DEFAULT NOW() | |
| atualizado_em | DATETIME | ON UPDATE NOW() | |

**Índices:** `numero_os`, `tipo`, `status`, `comarca_id`, `data_atendimento`

#### `equipamentos`
| Coluna | Tipo | Restrição | Descrição |
|--------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | |
| chamado_id | INT | FK → chamados.id | |
| patrimonio | VARCHAR(30) | | Nº patrimônio TJMG |
| serial | VARCHAR(50) | | Nº de série |
| tipo_equipamento | VARCHAR(50) | | Notebook, Desktop, Monitor, etc. |
| modelo | VARCHAR(80) | | Ex: DCM4A-4 |
| fabricante | VARCHAR(50) | | Ex: DATEN |
| acao | ENUM('VERIFICACAO','RETIRADA','INSTALACAO','TROCA') | NOT NULL | |
| tipo_movimentacao | ENUM('MANUTENCAO','DEVOLUCAO') | | Natureza da movimentação (Seção I do Laudo) |
| local_verificacao | VARCHAR(150) | | Local da verificação técnica |
| local_retirada | VARCHAR(150) | | Origem do equipamento |
| local_entrega | VARCHAR(150) | DEFAULT 'Sala Polo Divinópolis' | Destino do equipamento |

**Índices:** `patrimonio`, `serial`, `chamado_id`

#### `trocas`
| Coluna | Tipo | Restrição | Descrição |
|--------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | |
| chamado_id | INT | FK → chamados.id | |
| equip_retirado_id | INT | FK → equipamentos.id | |
| equip_instalado_id | INT | FK → equipamentos.id | |
| local_retirada | VARCHAR(150) | | Comarca/Setor de origem |
| local_entrega | VARCHAR(150) | DEFAULT 'Sala Polo Divinópolis' | Destino da retirada |
| data_troca | DATETIME | | |
| observacoes | TEXT | | |

#### `checklist_verificacao`
| Coluna | Tipo | Restrição | Descrição |
|--------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | |
| equipamento_id | INT | FK → equipamentos.id | |
| item | VARCHAR(100) | NOT NULL | Nome do item verificado |
| avaliacao_wyntech | ENUM('BOM','REGULAR','RUIM') | | Avaliação da Wyntech |
| avaliacao_tjmg | ENUM('BOM','REGULAR','RUIM') | | Avaliação do TJMG (preenchida à mão no impresso) |
| observacao | TEXT | | |

#### `acessorios`
| Coluna | Tipo | Restrição | Descrição |
|--------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | |
| equipamento_id | INT | FK → equipamentos.id | |
| tipo | VARCHAR(50) | NOT NULL | Cabo Energia, Fonte, Mouse, etc. |
| presente | BOOLEAN | DEFAULT FALSE | |
| descricao_outros | VARCHAR(120) | | Texto livre quando `tipo = 'Outros'` |

#### `fotos`
| Coluna | Tipo | Restrição | Descrição |
|--------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | |
| chamado_id | INT | FK → chamados.id | |
| equipamento_id | INT | FK → equipamentos.id, NULL | Opcional |
| caminho_arquivo | VARCHAR(255) | NOT NULL | Path relativo em /uploads/ |
| descricao | VARCHAR(200) | | Legenda da foto |
| tamanho_bytes | INT | | Tamanho após compressão |
| criado_em | DATETIME | DEFAULT NOW() | |

#### `documentos_gerados`
| Coluna | Tipo | Restrição | Descrição |
|--------|------|-----------|-----------|
| id | INT | PK, AUTO_INCREMENT | |
| chamado_id | INT | FK → chamados.id | |
| tipo_doc | ENUM('LAUDO','LAUDO_ROLLOUT','ROMANEIO') | NOT NULL | Documentos efetivamente gerados pelo Wyntech |
| gerado_em | DATETIME | DEFAULT NOW() | |
| dados_json | TEXT | | Snapshot dos dados usados na geração |

---

## 6. API — Endpoints

> **Nota (protótipo v0.7.0):** o protótipo **não tem API própria**. A única
> integração externa é o Web App do Apps Script, acessado por atalho, com
> importação de rascunho JSON pelo recurso “Abrir rascunho”. O script usa
> `google.script.run` (`buscarAtivo`, `salvarLaudo`), não expõe `doPost`/CORS e
> gera o PDF no cliente. Ver §0.4 e `docs/integracao-apps-script.md`. Os
> endpoints abaixo são o alvo de produção (PHP/MySQL) e não estão
> implementados.

### Autenticação

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login → retorna JWT |
| POST | `/api/auth/logout` | Invalidar token |
| POST | `/api/auth/refresh` | Renovar o JWT a partir do refresh token |
| GET | `/api/auth/me` | Dados do usuário logado |

### Chamados

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/chamados` | Listar (paginado, filtros via query) |
| GET | `/api/chamados/{id}` | Detalhe com equipamentos, fotos, etc. |
| POST | `/api/chamados` | Criar novo chamado |
| PUT | `/api/chamados/{id}` | Atualizar chamado |
| DELETE | `/api/chamados/{id}` | Remover chamado |

**Query params (GET list):** `?tipo=IN&status=ABERTO&comarca_id=5&page=1&limit=20&busca=TR1185`

### Equipamentos

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/chamados/{id}/equipamentos` | Adicionar equipamento ao chamado |
| PUT | `/api/equipamentos/{id}` | Atualizar equipamento |
| DELETE | `/api/equipamentos/{id}` | Remover equipamento |

### Trocas

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/chamados/{id}/trocas` | Registrar troca |
| GET | `/api/chamados/{id}/trocas` | Listar trocas do chamado |

### Fotos

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/chamados/{id}/fotos` | Upload de foto (multipart) |
| DELETE | `/api/fotos/{id}` | Remover foto |

### Comarcas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/comarcas` | Listar todas comarcas ativas |

### Documentos Gerados

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/chamados/{id}/documentos` | Listar os documentos gerados do chamado |
| POST | `/api/chamados/{id}/documentos` | Registrar snapshot (`tipo_doc` + `dados_json`) do documento emitido |

> **POP030:** a montagem dos scripts de fechamento (14 situações) é 100% client-side (módulo `pop030.js`) e **não** possui endpoint próprio. Se o técnico quiser arquivar o texto gerado, ele é salvo como observação do chamado ou no armazenamento local.

### Formato de Resposta Padrão

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 153
  }
}
```

```json
{
  "success": false,
  "error": "Patrimônio é obrigatório",
  "code": "VALIDATION_ERROR"
}
```

---

## 7. Telas e Navegação

### Rotas do protótipo (v0.7.0)

O protótipo usa **hash routing** (`location.hash`) e atualiza a tela a cada
`hashchange`. As rotas reais são:

| Rota | Tela | `data-screen` |
|------|------|---------------|
| `#/workspace` | Painel | `workspace` |
| `#/chamado` | Novo chamado | `chamado` |
| `#/equipamento` | Equipamento | `equipamento` |
| `#/fechamento` | Fechamento IN | `fechamento` |
| `#/rollout` | Rollout TR | `rollout` |
| `#/pop030` | POP030 | `pop030` |
| `#/documentos` | Documentos | `documentos` |
| `#/historico` | Histórico | `historico` |

Rota inválida cai em `#/workspace`. O título da aba e o contexto da topbar são
derivados de `ROUTE_LABELS`.

### Rotas alvo de produção

As rotas abaixo são o alvo de produção (ADR-004) e **não** são as usadas pelo
protótipo:

```text
#/                         → Dashboard
#/login                    → Login
#/chamados                 → Lista de chamados
#/chamados/novo            → Novo chamado
#/chamados/:id             → Detalhe
#/chamados/:id/editar      → Editar
#/chamados/:id/troca       → Troca
#/chamados/:id/documentos  → Documentos
#/configuracoes            → Configurações
```

O protótipo não implementa login, edição, exclusão nem configurações.

### Layout Responsivo

| Faixa | Layout |
|-------|--------|
| **> 900 px** | Sidebar fixa à esquerda (`#12201b`), topbar de contexto e conteúdo em grid. |
| **≤ 900 px** | Sidebar oculta; topbar sticky e bottom nav fixa com 5 atalhos. |
| **≤ 760 px** | Grids de 2–3 colunas passam a 1 coluna; cabeçalhos e ações empilham. |
| **≤ 560 px** | Formulários, chips, tabelas de documentos e botões ocupam a largura toda. |
| **≤ 400 px** | Ajustes finos de tipografia e bottom nav sem rótulos. |

O layout foi validado em desktop (1440 px) e em iframe de 390 px; as capturas
estão em `docs/capturas/`.

---

## 8. Documentos Gerados (PDFs) vs Lembretes de Checklist

> ⚠️ **REGRA FUNDAMENTAL:** O Wyntech gera **apenas** os documentos operacionais que o técnico precisa confeccionar em campo. Documentos oficiais pré-existentes do TJMG ou emitidos nativamente pelo HP **NÃO** são gerados pelo Wyntech, mas são **OBRIGATORIAMENTE cobrados no checklist interativo** para o técnico nunca esquecer nenhum passo.

### 8.1 Documentos que o Wyntech GERA (PDFs Client-Side & Impressão 1:1)

> 🔴 **REGRA CRÍTICA DE FIDELIDADE DOCUMENTAL (1:1):**
> É estritamente **PROIBIDO** alterar a formatação, cores, bordas, fontes ou disposição dos documentos. Eles devem reproduzir com fidelidade 1:1 idêntica os modelos impressos oficiais fornecidos nas prints:
> - **PRINT 02:** `LAUDO TÉCNICO` (Laudo de Rollout / Movimentação v5.0 Wyntech/TJMG)
> - **PRINT 03:** `ROMANEIO` (Substituição de Equipamento – Anexar ao Incidente TJMG GEOPE/COATE)

> **Implementação v0.7.0:** o protótipo **não usa jsPDF**. A folha A4 é
> HTML/CSS e a ação “Imprimir / Salvar PDF” usa `window.print()`. As cores são
> forçadas com `print-color-adjust: exact` e a validação gerou 1 página A4 por
> documento. O PDF oficial com consulta ao SIAD é emitido pelo gerador Apps
> Script (§0.4). Os logos ainda são placeholders tipográficos; ver
> `docs/conformidade-documental.md`.

1. **Laudo Técnico Normal & Laudo de Rollout (PRINT 02):**
   - **Modelo Oficial:** `Laudo Técnico Wyntech / TJMG — Versão 5.0 (unificada, uso geral)`.
   - **Estrutura Visual 1:1:**
     - Papel A4 branco, cabeçalho com identificação Wyntech (placeholder), título serifado `LAUDO TÉCNICO / Movimentação e Verificação de Equipamento de Informática` e linha divisória vermelha (`#a82020`).
     - Títulos das seções em preto sobre faixas cinza (`#e8e8e8`); a linha do cabeçalho é vermelha.
     - **Seção I (Identificação e Movimentação):** Tabela de 3 linhas (OS/Incidente, Data, Tipo [Manutenção/Devolução], Local de Verificação, Local de Retirada, Local de Entrega, Patrimônio, Nº de Série, Tipo de Equipamento/Modelo, Fabricante).
     - **Seção II (Entrega com):** Checkboxes (Cabo de Energia, Fonte/Carregador, Mouse, Teclado, Cabo de Dados/USB, Outros) e campo para justificativa.
     - **Seção III (Checklist Técnico de Verificação):** Tabela com cabeçalho cinza claro (`#cfcfcf`) e texto preto: 6 itens avaliados com checkboxes Bom / Regular / Ruim para WYNTECH e TJMG.
     - **Seção IV (Avarias):** Checkbox Não/Sim e detalhamento.
     - **Seção V (Observações Gerais):** Caixa delimitada para notas operacionais.
     - **Seção VI (Declaração):** Declaração formal de recolhimento para **Manutenção** ou **Estoque para a Sala Polo da comarca** (no rollout de demonstração, Divinópolis).
     - **Seção VII (Assinaturas):** Três colunas de assinaturas (Responsável Técnico Wyntech, Responsável TJMG, Entregue para / Recebido por), ancoradas no pé da folha.
     - Rodapé “Laudo Técnico WYNTECH — Modelo oficial de uso interno”.

2. **Romaneio de Transporte / Substituição (PRINT 03):**
   - **Modelo Oficial:** `SUBSTITUIÇÃO DE EQUIPAMENTO — Anexar ao Incidente (TJMG COATE/GEOPE)`.
   - **Estrutura Visual 1:1:**
     - Caixa superior contendo representação vetorial do logo triangular TJMG (placeholder) à esquerda e texto institucional oficial: `TRIBUNAL DE JUSTIÇA DO ESTADO DE MINAS GERAIS / Diretoria Executiva de Tecnologia da Informação e Comunicação – GEOPE/COATE`.
     - Título em destaque: `SUBSTITUIÇÃO DE EQUIPAMENTO / Anexar ao Incidente`.
     - Data de Retirada, Horário e caixa com `COMARCA/UNIDADE` e `INCIDENTE`.
     - **Tabela 1:** `RETIRADA EQUIPAMENTO - COMARCA/SETOR ➔ SALA POLO` (Equipamento, Patrimônio, Número de Série).
     - **Tabela 2:** `SUBSTITUIÇÃO EQUIPAMENTO - SALA POLO ➔ COMARCA/SETOR` (Equipamento, Patrimônio, Número de Série).
     - **OBSERVAÇÕES:** Caixa com fundo cinza claro (`#f0f1f3`), exatamente como no modelo impresso.
     - **Tabela de Assinaturas:** USUÁRIO (Matrícula, Ass), TÉCNICO (Matrícula, Ass) e RESPONSÁVEL TRANSPORTE (Ass).
     - Data completa por extenso no canto inferior esquerdo (ex: `quarta-feira, 14 de outubro de 2026`).

> **Logos:** o protótipo usa representações tipográficas/vetoriais simplificadas
> (bloco “WYNTECH” e triângulo “TJMG”), não os arquivos oficiais de marca.
> Substitua pelos arquivos institucionais antes da produção. O restante do
> layout documental está implementado; ver
> `docs/conformidade-documental.md` §4.6.

---

### 8.2 Documentos que o Wyntech NÃO GERA (Mas COBRA OBRIGATORIAMENTE no Checklist)

| Documento Externo | Origem | Ação do Wyntech no Checklist |
|-------------------|--------|------------------------------|
| **RAT (do HP)** | Gerado nativamente no botão `[RAT]` do HP Service Manager | Lembrete de checklist: *Imprimir e colher assinatura do usuário* |
| **RAT_ROLLOUT** | Formulário padrão de rollout fornecido pelo projeto/tribunal | Lembrete de checklist: *Preencher RAT_ROLLOUT e coletar assinaturas* |
| **Guia de Transferência** | Já vem anexada em PDF diretamente na tarefa (TR `CHXXXXXXX`) | Lembrete de checklist: *Baixar/anexar Guia de Transferência da TR* |
| **Termo de Responsabilidade** | Modelo próprio do tribunal para notebooks institucionais | Lembrete com alerta crítico: *Coletar Termo de Responsabilidade (**VALE APENAS COM ASSINATURA DO MAGISTRADO**)* |
| **Foto com Chip, Serial e Patrimônio** | Evidência fotográfica de campo do **notebook novo** | Upload/Câmera obrigatório: *Foto legível mostrando chip (SIM/4G), número de série e etiqueta de patrimônio* |

---

### 8.3 Ações Disponíveis nos Documentos e Modo Contingência (Folha em Branco)

No protótipo, cada card de documento oferece:

1. **Visualizar** — abre o modal com a folha A4 e a alternância Preenchido/Em branco.
2. **Imprimir** — abre o modal e aciona `window.print()`; no diálogo, use “Salvar como PDF”.
3. **WhatsApp** — compartilha um resumo textual do atendimento; não envia o PDF.
4. **Em branco** — abre o mesmo template sem os dados, para preenchimento manual.

Dentro do modal:

- **Preenchido / Em branco** alterna o modo sem fechar a pré-visualização;
- **WhatsApp** compartilha o resumo do atendimento;
- **Imprimir / Salvar PDF** usa `window.print()`.

**Não existe “Baixar PDF” no protótipo.** A geração local é feita pela janela
de impressão do navegador; o PDF oficial com consulta ao SIAD é gerado pelo
Apps Script. O modo em branco mantém o mesmo layout, com campos e checkboxes
vazios; não altera estilo ou modelo.

---

## 9. Regras de Negócio

### Regras Operacionais Oficiais (Diretrizes COATEC / Wyntech)

| # | Regra | Detalhamento Operacional |
|---|-------|--------------------------|
| **RN01** | Tipo de Chamado | Todo atendimento deve ter `numero_os` e tipo (`IN`, `TR`, `REQ`). |
| **RN02** | Registro de Troca | Registra 1 equipamento retirado (S) e 1 instalado (I). |
| **RN03** | Destino Padrão | Equipamentos retirados seguem para **Sala Polo — TJMG Divinópolis** (cód. localidade: `1035145 COATEC - POLO DVL - RECOLHIMENTO`). |
| **RN04** | Compressão de Fotos | Fotos comprimidas client-side antes do upload (max 1200px, ~200KB). |
| **RN05** | Preenchimento do Laudo | Coluna WYNTECH preenchida no app; coluna TJMG é manual no impresso. |
| **RN06** | Dados SIAD | Sugestões editáveis; correções prevalecem no laudo. |
| **RN07** | **Transferência Patrimonial Obrigatória** | Ao substituir equipamento em incidente, é obrigatório abrir tarefa no HP com título `Transferência Patrimonial - Polo Divinópolis`. Descrição padrão obrigatória discriminando `(PAT COM DEFEITO) para 1035145 COATEC - POLO DVL - RECOLHIMENTO` e `(PAT BOM) para (COMARCA X)`. **Anexar exclusivamente o Romaneio na tarefa.** |
| **RN08** | **Modelo Idêntico de Desktops** | **PROIBIDO** substituir desktop por um modelo diferente do incidente (gera penalidade contratual perante o TJMG). |
| **RN09** | **Detalhamento Específico de Peças** | **PROIBIDO** usar descrições genéricas no encerramento (ex: "substituído cabo" ou "substituído adaptador"). Obrigatório especificar exatamente o item: `Adaptador HDMI para VGA`, `Adaptador DisplayPort para HDMI`, `Cabo de rede CAT6`, `Cabo HDMI`, `Cabo de força`, etc. Itens com serial exigem serial no fechamento e Romaneio de Movimentação anexado. |
| **RN10** | **Procedimento para Teclados e Mouses** | Periféricos são provenientes de reutilização da COPAT. **Antes de substituir**, é obrigatória a tentativa de limpeza e recuperação (especialmente casos de teclas endurecidas). Se recuperado, o técnico pode manter em sua reserva técnica. |
| **RN11** | **Equipamentos em Garantia** | • *Lenovo:* técnico substitui com peça reserva e solicita reposição para seu kit ao entregar o defeituoso no polo.<br>• *Daten:* solicitação deve ser feita diretamente junto à sala polo. |
| **RN12** | **Microfones e Caixas de Som (SEI / DENGEP)** | Demanda de responsabilidade exclusiva dos setores **GEASE** e **COTESI** (vinculados à DENGEP). O técnico **NÃO deve recolher nem substituir**. Deve orientar formalmente o usuário a abrir processo via **SEI**. |
| **RN13** | **Caso Fortuito / Fenômenos da Natureza / Ausência de Peças** | Equipamentos danificados por raio, enchente, fenômeno natural ou furto/ausência de componentes **NÃO DEVEM SER RECOLHIDOS NEM SUBSTITUÍDOS** (mesmo com chamado aberto por outro defeito). Procedimento obrigatório:<br>1. Elaborar **Laudo de Caso Fortuito** com fotos e relato.<br>2. Orientar usuário a formalizar via SEI para a **COPAT**.<br>3. Registrar orientações expressas na RAT.<br>4. Colher ciência formal do Usuário, Responsável do Setor e **Administrador da Comarca**.<br>5. Anexar fotos, RAT e Laudo de Caso Fortuito antes de encerrar o incidente. |
| **RN14** | **Compra Emergencial de Peças** | Na ausência de saldo na sala polo e com chamado contabilizando SLA, solicitar compra pontual para `compras@wyntech.inf.br` e `almoxbh@wyntech.inf.br` com assunto padronizado (`PEDIDO DE COMPRA / [PROJETO] / [PEÇA] / [CHAMADO]`). Envio obrigatório da Nota Fiscal digitalizada em PDF em até 24h após confirmação do pagamento. |
| **RN15** | **Procedimento: Usuário Ausente** | Se o usuário não estiver no local: atualizar imediatamente no HP indicando **o nome de quem informou a ausência** e **todas as informações colhidas** (previsão de retorno, horário em que poderá receber). **REGRA CRÍTICA: NÃO SERÁ REALIZADA A SUSPENSÃO DO CHAMADO!** |
| **RN16** | **Dados Oficiais da Empresa (Wyntech)** | Dados para cabeçalhos e faturamento: `WYNTECH SERVIÇOS EM TECNOLOGIA DA INFORMAÇÃO LTDA`, CNPJ: `08.911.585/0006-18`, Endereço: `Rua Biquinhas, 183 - Betânia, Belo Horizonte - MG, CEP 30.580-400`, IE: `00375599700-10`, IM: `12297000016`. |
| **RN17** | **Cancelamento de Incidente (Curadoria)** | Quando o usuário solicitar cancelamento (com atualização no chamado): enviar no grupo de WhatsApp `CANCELAMENTO IN` o script padrão: `Solicito o cancelamento do incidente de numero XXXXXXX, o mesmo possui atualização feita pelo usuário conforme abaixo: [Atualização do HP]`. A curadoria confirma reagindo com 👍. |
| **RN18** | **Erro de Recaptcha / Acesso Projudi (Proxy)** | Problema decorrente de política de firewall/proxy. O técnico **não resolve localmente**; orienta a chefia do setor a abrir chamado no HP no caminho: `Principal > CONECTIVIDADE > INTERNET > Solicitação de acesso - informações`. Somente chefias (Escrivão, Administrador, Juiz na 1ª Instância / Coordenador, Gerente, Assessor na 2ª Instância) podem solicitar ampliação de acesso. |
| **RN19** | **POP030 — Scripts de Fechamento de Tarefas no HP** | Obrigatória a adoção rigorosa dos scripts do documento oficial **POP030 - Versão 3.5 (FEV/2025)** para o campo Solução/Fechamento das tarefas no HP Service Manager. Contempla 14 situações detalhadas na seção 9.1. |
| **RN20** | **Exportação Multicanal e Contingência em Papel** | Todo documento emitido (Laudo Normal, Laudo Rollout, Romaneio) deve permitir: Download PDF, Impressão Direta, Compartilhamento via WhatsApp e **Emissão de Modelo em Branco** para contingência de campo. |
| **RN21** | **Fidelidade Visual 1:1 dos Modelos Impressos (PRINT 02 e PRINT 03)** | É expressamente proibido desviar ou inventar estilos alternativos para os documentos gerados. O Laudo Técnico / Rollout deve ser rigorosamente 1:1 com a PRINT 02 (Versão 5.0 unificada com seções em vermelho escuro `#a82020` e checklist cinza `#595959`). O Romaneio deve ser rigorosamente 1:1 com a PRINT 03 (Substituição de Equipamento TJMG GEOPE/COATE com campo de observações em fundo cinza `#f0f1f3`). O modo 'Em Branco' deve preservar 100% o mesmo esqueleto formal, substituindo apenas os valores por linhas de preenchimento manual à caneta. |

---

### 9.1 POP030 — Script Padrão de Comentário de Fechamento das Tarefas (Versão 3.5 - FEV/2025)

*Documento Emitido por: Gestão Wyntech & COMEQ (Maiura Freitas Peixoto / Guilherme Fernandes / Edda Figueiredo / André COMEQ).*

O Wyntech automatiza o preenchimento dos 14 tipos de fechamento no HP, substituindo as variáveis dinamicamente:

#### 1. Situações que Envolvem Acréscimo
*Texto base:* `Foi realizado o acréscimo dos [equipamentos] listados abaixo:`
- **Computadores:** `(Patrimônio do computador – Patrimônio do monitor – Nome do usuário – Nome do Setor)`
- **Notebooks:** `(Patrimônio do notebook – Nome do usuário – Nome do Setor)`
- **Monitores Avulsos:** `(Patrimônio do monitor – Nome do usuário – Nome do Setor – Patrimônio do computador – Tipo de cabo utilizado)`
- **Escâneres de Mesa:** `(Patrimônio do escâner – Nome do usuário – Nome do Setor – Patrimônio do computador)`
- **Impressoras ou Multifuncionais:** `(Patrimônio da impressora – Nome do Setor)`
- **Periféricos:** `(Tipo de periférico - Patrimônio – Nome do usuário – Nome do Setor – Patrimônio do computador)`
- **Switch:** `(Patrimônio do switch – Nome do Setor – andar)`
- **Access Point:** `(Patrimônio do access point – Nome do Setor – andar)`
- **Servidor de Rede:** `(Patrimônio do servidor de rede – Nome do Setor – andar)`

#### 2. Situações que Envolvem Substituição (Formato S: / I:)
*Uso padronizado dos prefixos **S:** (Substituído/Retirado) e **I:** (Incluído/Instalado).*
- **Computadores:** `Foi realizado a substituição do computador: (S: Patr. do computador substituído – S: Patr. do monitor substituído – I:Patr. do computador incluído – I: Patr. do monitor incluído - Nome do usuário – Nome do Setor)`
- **Computadores (Irreparabilidade):** `Foi realizado a substituição do computador sobressalente: (S: Patr. do computador sobressalente (Wyntech) – I:Patr. do computador incluído – I: Patr. do monitor incluído - Nome do usuário – Nome do Setor)`
- **Notebooks:** `Foi realizado a substituição do computador: (S: Patr. do notebook substituído – I:Patr. do notebook incluído – Nome do usuário – Nome do Setor)`
- **Notebooks (Irreparabilidade):** `Foi realizado a substituição do notebook sobressalente: (S: Patr. do notebook sobressalente (Wyntech) – I:Patr. do notebook incluído – Nome do usuário – Nome do Setor)`
- **Monitor Avulso:** `Foi realizada a substituição dos monitores listados abaixo: (S: Patr. do monitor substituído – I: Patr. do monitor incluído – Nome do usuário – Nome do Setor – Patr. do computador – tipo de cabo utilizado)`
- **Monitor (Irreparabilidade):** `Foi realizado a substituição do monitor sobressalente: (S: Patr. do monitor sobressalente (Wyntech) – I:Patr. do monitor incluído – Nome do usuário – Nome do Setor)`
- **Escâneres de Mesa:** `Foi realizada a substituição dos escâneres listados abaixo: (S: Patr. do escâner substituído – I: Patr. do escâner incluído – Nome do usuário – Nome do Setor)`
- **Impressoras ou Multifuncionais:** `Foi realizada a substituição das impressoras listadas abaixo: (S: Patr. da impressora substituída – I: Patr. da impressora incluída – Nome do Setor)`
- **Periféricos:** `Foi realizada a substituição dos periféricos listados abaixo: (Tipo do periférico - S: Patr. do periférico substituído – I: Patr. do periférico incluído – Nome do usuário – Nome do Setor – Patr. do computador)`
- **Switch:** `Foi realizada a substituição do switch listado abaixo: (S: Patr. do switch substituído – I:Patr. do switch incluído – Nome do Setor – andar)`
- **Access Point:** `Foi realizada a substituição dos access points listado abaixo: (S: Patr. do access point substituído – I:Patr. do access point incluído – Nome do Setor – andar)`
- **Servidor de Rede:** `Foi realizada a substituição do servidor de rede listado abaixo: (S: Patr. do servidor de rede substituído – I: Patr. do servidor de rede incluído – Nome do Setor – andar)`

#### 3. Situações que Envolvem Instalação
- **Computadores:** `Foi realizada a instalação dos computadores listados abaixo: (Patrimônio do computador – Patrimônio do monitor – Nome do usuário – Nome do Setor)`
- **Notebooks:** `Foi realizada a instalação dos computadores listados abaixo: (Patrimônio do notebook – Nome do usuário – Nome do Setor)`
- **Monitores Avulsos:** `Foi realizada a instalação dos monitores listados abaixo: (Patrimônio do monitor – Nome do usuário – Nome do Setor – Patrimônio do computador – Tipo de cabo utilizado)`
- **Escâneres de Mesa:** `Foi realizada a instalação dos escâneres listados abaixo: (Patrimônio do escâner – Nome do usuário – Nome do Setor – Patrimônio do computador)`
- **Impressoras Matriciais:** `Foi realizada a instalação das impressoras listadas abaixo: (Patrimônio da impressora – Nome do Setor)`
- **Periféricos:** `Foi realizada a instalação dos periféricos listados abaixo: (Tipo de periférico – Patrimônio – Nome do usuário – Nome do Setor – Patrimônio do computador)`
- **Peças:** `Foi realizada a instalação das seguintes peças: (Tipo de peça – Patrimônio do equipamento – Nome do usuário – Nome do setor – Edificação)`
- **Switch:** `Foi realizada a instalação dos switches listados abaixo: (Patrimônio do switch – Nome do Setor – andar)`
- **Access Point:** `Foi realizada a instalação dos access points listados abaixo: (Patrimônio do access point – Nome do Setor – andar)`
- **Instalação / Atualização / Configuração de Aplicativos:** `Foi realizada a instalação/atualização/configuração dos aplicativos listados abaixo: (Nome do aplicativo com o número da versão – Patrimônio do computador – Nome do usuário – Nome do setor - Edificação)`
- **Desinstalação de Aplicativos:** `Foi realizada a desinstalação dos aplicativos listados abaixo: (Nome do aplicativo com o número da versão – Patrimônio do computador – Nome do usuário – Nome do setor - Edificação)`
- **Remanejamento de Licenças:** `Foi realizado o remanejamento das licenças listadas abaixo: (Nome da licença com o número da versão – Patrimonio computador de origem - Usuário origem - Nome do setor origem / Patrimonio computador destino – Usuário destino – Nome do setor destino)`

#### 4. Situações que Envolvem Empréstimo
`Foi realizado o empréstimo dos equipamentos listados abaixo:`  
`(Tipo de equipamento – Quantidade – Patrimônios – Nome do setor – Nome do usuário)`

#### 5. Situações que Envolvem Remanejamento
`Foi realizado o remanejamento dos equipamentos listados abaixo:`  
`(Tipo de Equipamento – Patrimônio do Equipamento – Usuário Origem / Setor Origem - Usuário Destino / Setor Destino)`

#### 6. Situações que Envolvem Mudança Predial
`Foi realizada a mudança predial de todos os equipamentos listados abaixo: (relacionar TODOS os equipamentos envolvidos na Mudança Predial). Em caso de avarias ou qualquer outra situação que fuja da normalidade de uma Mudança Predial, relacionar aqui nesse espaço em um campo de OBSERVAÇÕES.`  
- **COMPUTADOR:** `(Patrimônio do Equipamento – Nome do usuário – Nome do setor onde o equipamento foi instalado)`
- **MONITOR:** `(Patrimônio do Equipamento – Nome do usuário – Nome do setor onde o equipamento foi instalado)`
- **NOTEBOOK:** `(Patrimônio do Equipamento – Nome do usuário – Nome do setor onde o equipamento foi instalado)`
- **ESCÂNER:** `(Patrimônio do Equipamento – Nome do setor onde o equipamento foi instalado)`
- **IMPRESSORA MATRICIAL:** `(Patrimônio do Equipamento – Nome do setor onde o equipamento foi instalado)`
- **SERVIDOR DE REDE:** `(Patrimônio do Equipamento – Nome do setor onde o equipamento foi instalado)`
- **SWITCH:** `(Patrimônio do Equipamento – Nome do setor onde o equipamento foi instalado)`
- **ACCESS POINT:** `(Patrimônio do Equipamento – Nome do setor onde o equipamento foi instalado)`
- **WEB CAM:** `(Patrimônio do Equipamento – Nome do setor onde o equipamento foi instalado)`
- **MICROFONE:** `(Patrimônio do Equipamento – Nome do setor onde o equipamento foi instalado)`

#### 7. Situações de Acompanhamento Técnico para Eventos
`Foi realizado o acompanhamento técnico no local do evento.`  
`(Nomes dos técnicos que acompanharam o evento – Datas do acompanhamento técnico)`

#### 8. Situações que Envolvem Transporte de Equipamentos
`Foi realizado o transporte dos equipamentos listados abaixo:`  
`(Local de origem)`  
`(Local de destino)`  
`(Tipo de equipamento – Patrimônio)`

#### 9. Situações que Envolvem Recolhimento de Equipamentos
`Foi realizado o recolhimento dos equipamentos listados abaixo:`  
`(Tipo de equipamento – Patrimônio do Equipamento – Nome do usuário – Nome do setor)`

#### 10. Situações que Envolvem Manutenção Preventiva de Escâner
`Foi realizada a manutenção preventiva do(s) Escâner(es) com o(s) patrimônio(s) relacionado(s) abaixo:`  
`(Patrimônio, Patrimônio, ...)`

#### 11. Situações que Envolvem Intervenções no Ativo de Rede Switch
`Foi realizado a intervenção no switch conforme informações listados abaixo:`  
`(Solução)`  
`(Problemas de hardware [ porta inoperante | cabo defeituoso | cabo não homologado | interruptor | ... ])`  
`(Problemas de configuração)`  
`(Problemas de tráfego)`  
`(Especificar nº Porta)`  
`(Especificar Patrimonio)`  
`(Diagnóstico do Problema)`  
`(Agente do Diagnóstico [Técnicos rede Wyntech | Analistas rede Stefannini])`

#### 12. Situações que Envolvem Remanejamento Predial (Entre Unidades/Edificações)
`Foi realizado o remanejamento dos equipamentos listados abaixo entre as Unidades (Edificações):`  
`(Tipo de Equipamento – Patrimônio do Equipamento – Unidade de origem / Usuário Origem / Setor Origem - Unidade de destino / Usuário Destino / Setor Destino)`

#### 13. Situações que Envolvem Ativação de Ponto de Rede
`Foi realizado a ativação do ponto de rede com os seguintes informes abaixo:`  
`(Tipo de periférico [computador | impressora | access point | ...] – Patrimônio Periférico – Nome do Setor – Patrimônio Switch)`

#### 14. Situações que Envolvem Vistoria Técnica: Levantamento de Informações Prediais
`Foi realizado o levantamento de informações, conforme detalhamento abaixo e planilha anexada à tarefa de execução:`  
- **COMPUTADOR:** `(Patrimônio do Equipamento – Nome do usuário – Nome do setor – Guardado em armário (S/N))`
- **MONITOR:** `(Patrimônio do Equipamento – Nome do usuário – Nome do setor – Guardado em armário (S/N))`
- **NOTEBOOK:** `(Patrimônio do Equipamento – Nome do usuário – Nome do setor – Guardado em armário (S/N))`
- **ESCÂNER:** `(Patrimônio do Equipamento – Nome do setor – Guardado em armário (S/N))`
- **IMPRESSORA LASER:** `(Patrimônio do Equipamento – Nome do setor – Guardado em armário (S/N))`
- **IMPRESSORA MULTIFUNCIONAL:** `(Patrimônio do Equipamento – Nome do setor – Guardado em armário (S/N))`
- **IMPRESSORA MATRICIAL:** `(Patrimônio do Equipamento – Nome do setor – Guardado em armário (S/N))`

---

## 10. Performance e Otimização

> **Nota (protótipo v0.7.0):** as metas abaixo são do MVP de produção. O
> protótipo atual já é um único HTML de ~204 KB, sem requests externos, fontes
> do sistema e sem dependências de runtime; portanto, o carregamento local é
> praticamente imediato. As estratégias de PWA, compressão e backend ainda não
> estão implementadas.

### Metas

| Métrica | Meta | Como medir |
|---------|------|------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.0s | Lighthouse |
| Bundle total (JS+CSS) | < 150KB no alvo de produção (protótipo: ~204KB em HTML único) | Build size |
| Foto upload (5MB original) | < 300KB | Compressor.js output |
| Lighthouse Performance Score | > 90 | Chrome DevTools |

### Estratégias de Otimização

| Estratégia | Arquivo | Impacto |
|------------|---------|---------|
| Zero framework (Vanilla JS) | js/*.js | -300KB bundle |
| Compressão de imagens client-side | js/image-compressor.js | -95% tamanho upload |
| Service Worker cache | sw.js | Carrega offline após 1ª visita |
| Gzip via .htaccess | .htaccess | -70% tamanho de transferência |
| Lazy loading de fotos | js/pages/chamado-detail.js | Carrega sob demanda |
| CSS modular (sem framework CSS) | css/*.css | ~15KB total |
| Fontes locais (sem CDN) | assets/fonts/ | Sem request externo |
| Debounce em buscas | js/utils.js | Menos chamadas à API |
| Paginação (20 itens/page) | api/controllers/ | Respostas leves |
| PDF/impressão client-side | js/templates/*.js ou `window.print()` | Zero processamento no servidor |

### Cache Policy (.htaccess)

```apache
# Assets estáticos: cache longo (1 ano) com hash busting
ExpiresByType text/css "access plus 1 year"
ExpiresByType application/javascript "access plus 1 year"
ExpiresByType font/woff2 "access plus 1 year"

# HTML: revalidar sempre
ExpiresByType text/html "access plus 0 seconds"

# API: sem cache (válido em .htaccess — não usar <Location>)
<IfModule mod_headers.c>
  SetEnvIf Request_URI "^/api/" API_NO_CACHE
  Header set Cache-Control "no-cache, no-store" env=API_NO_CACHE
</IfModule>
```

---

## 11. Segurança

> **Nota (protótipo v0.7.0):** não há autenticação nem backend no protótipo;
> os dados ficam no `localStorage` do dispositivo e os exemplos são fictícios.
> O Web App do Apps Script é uma implantação externa; antes de usar dados
> reais, restrinja o acesso ao domínio TJMG e revise o modo “Executar como”.
> O rascunho JSON contém os dados do atendimento e deve ser tratado como
> documento sensível.

| Medida | Implementação (alvo de produção) |
|--------|--------------|
| **Autenticação** | JWT com expiração (24h), refresh token |
| **Senhas** | bcrypt hash (PHP `password_hash()`) |
| **SQL Injection** | PDO prepared statements em todas as queries |
| **XSS** | Sanitização de inputs, `htmlspecialchars()` no output |
| **CSRF** | Token por sessão em formulários |
| **Upload** | Validação de tipo MIME, tamanho máximo, rename aleatório |
| **Diretório uploads/** | .htaccess bloqueia execução de PHP |
| **HTTPS** | Forçado via .htaccess redirect |
| **Headers** | `X-Content-Type-Options`, `X-Frame-Options`, `CSP` |
| **Rate Limiting** | Limite de requests por IP (login: 5/min) |
| **Protótipo / dados locais** | Sem backend; `localStorage` (`wyntech.campo.v1`); dados de demonstração fictícios. |
| **Apps Script** | Web App externo; restringir “Quem tem acesso” ao domínio TJMG; revisar “Executar como”; não usar dados reais na implantação pública atual. |
| **LGPD** | Não comitar dados reais; limpar o `localStorage` em máquinas compartilhadas; tratar rascunhos/PDFs como documentos sensíveis. |

---

## 12. Status de Desenvolvimento

> **Nota (v0.7.0):** o **protótipo navegável está entregue e validado**; as
> fases abaixo rastreiam o **MVP de produção** (backend PHP/MySQL,
> autenticação, PWA). O protótipo não substitui esses itens. Entregas do
> protótipo estão na tabela 12.1; o changelog completo está no §13.

### 12.1 Protótipo v0.7.0 — concluído

| Item | Status | Evidência |
|------|--------|-----------|
| 8 telas + hash routing | ✅ | `prototipo/index.html`; capturas em `docs/capturas/` |
| Layout responsivo desktop/mobile | ✅ | capturas desktop e mobile |
| Laudo Técnico (normal/rollout/em branco) | ✅ | `docs/exemplos/laudo-*.pdf` |
| Romaneio (preenchido/em branco) | ✅ | `docs/exemplos/romaneio-*.pdf` |
| Impressão A4 em 1 página | ✅ | 5 PDFs, MediaBox 594,96 × 841,92 pt |
| Rascunho do gerador oficial | ✅ | `npm run verify:draft`; `docs/integracao-apps-script.md` |
| Documentação e build reproduzível | ✅ | `README.md`, `docs/`, `node prototipo/build.js` |
| Backend, auth, PWA, SIAD no app | ⬜ | alvo de produção (fases abaixo) |

### Legenda de Status

| Ícone | Significado |
|-------|-------------|
| ⬜ | Não iniciado |
| 🔵 | Em andamento |
| ✅ | Concluído |
| 🔴 | Bloqueado |
| 🟡 | Aguardando informação |

### Fase 1 — MVP (Fundação)

| # | Tarefa | Status | Prioridade | Notas |
|---|--------|--------|------------|-------|
| 1.1 | Setup do projeto (estrutura de pastas) | ⬜ | Alta | |
| 1.2 | Design system (CSS variables, base, componentes) | ⬜ | Alta | |
| 1.3 | SPA Router (hash-based) | ⬜ | Alta | |
| 1.4 | Tela de login | ⬜ | Alta | |
| 1.5 | Dashboard | ⬜ | Alta | |
| 1.6 | Formulário de novo chamado | ⬜ | Alta | |
| 1.7 | Backend: API PHP (router + config + auth) | ⬜ | Alta | |
| 1.8 | Backend: CRUD Chamados | ⬜ | Alta | |
| 1.9 | Schema SQL + seed de comarcas | ⬜ | Alta | |
| 1.10 | Lista de chamados com filtros | ⬜ | Média | |
| 1.11 | Detalhe do chamado | ⬜ | Média | |
| 1.12 | Geração PDF: Laudo Técnico Unificado (v5.0) | 🟡 | Alta | Modelo A4 e impressão validados no protótipo; PDF de produção pendente. RAT é do HP. |

### Fase 2 — Funcionalidades Core

| # | Tarefa | Status | Prioridade | Notas |
|---|--------|--------|------------|-------|
| 2.1 | Fluxo de troca de equipamento | ⬜ | Alta | |
| 2.2 | Geração PDF: Laudo de Rollout (notebook antigo) | 🟡 | Alta | Modelo e impressão prontos no protótipo; produção pendente. |
| 2.3 | Geração PDF: Romaneio (Substituição de Equipamento) | 🟡 | Alta | Modelo 1:1 e impressão prontos no protótipo; integração de produção pendente. |
| 2.4 | Upload + compressão de fotos | ⬜ | Média | |
| 2.5 | Galeria de fotos por chamado | ⬜ | Média | |
| 2.6 | Auto-save / rascunho (IndexedDB) | ⬜ | Média | |

### Fase 3 — PWA e Offline

| # | Tarefa | Status | Prioridade | Notas |
|---|--------|--------|------------|-------|
| 3.1 | Service Worker + cache de assets | ⬜ | Média | |
| 3.2 | IndexedDB para dados offline | ⬜ | Média | |
| 3.3 | Sincronização ao reconectar | ⬜ | Média | |
| 3.4 | PWA manifest + instalação | ⬜ | Média | |

### Fase 4 — Polimento

| # | Tarefa | Status | Prioridade | Notas |
|---|--------|--------|------------|-------|
| 4.1 | Busca avançada (patrimônio, serial, comarca) | ⬜ | Baixa | |
| 4.2 | Exportação CSV/Excel | ⬜ | Baixa | |
| 4.3 | Tema escuro | ⬜ | Baixa | |
| 4.4 | Animações e micro-interações | ⬜ | Baixa | |
| 4.5 | Testes e performance audit | ⬜ | Baixa | |

---

## 13. Changelog

Registro de todas as mudanças significativas no projeto.

### [0.7.0] — 2026-10-19
#### Entregue (Protótipo final + integração oficial)
- **Protótipo reescrito e finalizado:** 8 telas, design system sóbrio, sidebar no desktop, topbar + bottom nav no mobile, hash routing e `localStorage` (`wyntech.campo.v1`).
- **Documentos A4:** Laudo Técnico Unificado v5.0 (atendimento e rollout) e Romaneio, nos modos Preenchido e Em branco; rótulos em bloco, checkboxes CSS, faixas cinza, OBS ampliado e assinaturas no pé da folha.
- **Impressão/PDF local:** `window.print()` com `@page A4`, isolamento da aplicação/modal e `print-color-adjust: exact`; 5 PDFs validados em 1 página A4.
- **Integração oficial:** painel “Gerador oficial do Laudo” em Documentos, atalho para o Web App e rascunho JSON `{versao:1,dados}` importável em “Abrir rascunho”; sem alterar o Apps Script.
- **Build e testes:** fontes em `prototipo/src/`; `node prototipo/build.js`; preview em `scripts/serve.js`; contrato do rascunho em `scripts/verify-draft.js` (`npm run verify:draft`).
- **Documentação:** `README.md`, `CHANGELOG.md`, `docs/integracao-apps-script.md`, `docs/conformidade-documental.md`, capturas e PDFs de exemplo.
- **Correções:** logos ainda são placeholders; não há PDF falso; o gerador oficial usa `google.script.run` e não expõe API direta.
- **Pendente:** prefill automático do gerador oficial (requer alterar `doGet`/HTML do Apps Script), backend/auth/PWA de produção e aplicação dos logos oficiais.

### [0.6.0] — 2026-10-19
#### Corrigido (Consistência Documental e Eliminação de Contradições)
- **Documentos gerados:** o §1 deixou de afirmar que o Wyntech gera RAT/Termo de Substituição; agora reflete fielmente o §8 (apenas Laudo Técnico, Laudo de Rollout e Romaneio). A tabela de tipos de chamado (REQ) foi ajustada.
- **Modelo de dados (§5):** `documentos_gerados.tipo_doc` corrigido de `('RAT','ROMANEIO','SUBSTITUICAO')` para `('LAUDO','LAUDO_ROLLOUT','ROMANEIO')`; adicionada a coluna `avaliacao_tjmg` ao checklist; adicionados contato/matrícula/telefone em `chamados`, movimentação/locais em `equipamentos` e `descricao_outros` em `acessorios`.
- **API (§6):** adicionado `/api/auth/refresh`; criada a seção de Documentos Gerados; documentado que o POP030 é client-side e não possui endpoint.
- **Navegação (§7):** adicionada a correspondência entre as rotas hash alvo e as telas do protótipo (que usa `screen-id`).
- **Stack (§2):** fontes corrigidas para Plus Jakarta Sans + JetBrains Mono; Lucide/SVG inline; tabela de libs ganhou a coluna "Estado no protótipo" (jsPDF ainda não integrado — usa `window.print()`).
- **Estrutura de pastas (§4):** adicionados `print.css`, `equipamento-form.js`, `pop030.js`, `DocumentoController.php`/`Documento.php`; templates renomeados para `laudo-tecnico.js`, `laudo-rollout.js` e `romaneio.js`.
- **Status (§12) e Pendências (§15):** removida a contradição com o changelog; tarefas 1.12/2.2/2.3 corrigidas; P02 marcada como resolvida.
- **Referências (§16):** corrigido o link do Compressor.js; Inter substituída por Plus Jakarta Sans/JetBrains Mono.
- **ADR-003/ADR-005:** esclarecido que a geração por jsPDF é meta de produção e que documentos externos do tribunal não são gerados.

### [0.5.0] — 2026-10-14
#### Corrigido & Aprimorado (Fidelidade Documental 1:1 e Navegação)
- **Correção da Barra Superior / Subnav:** Eliminado o corte horizontal que truncava o botão "3. Rollout TR" e as abas seguintes. Aumentada a largura máxima para 960px com `flex-shrink: 0`, scroll suave horizontal com barra visível de 5px e auto-scroll dinâmico para a aba ativa.
- **Fidelidade 1:1 de PRINT 02 (LAUDO ROLLOUT):** Implementado o modelo exato do Laudo Técnico Unificado Versão 5.0 (Wyntech/TJMG), em folha branca A4 com logo Wyntech oficial em vetor, títulos de seções em vermelho escuro (`#a82020`), tabela de identificação de 3 linhas, checkboxes de acessórios, tabela de checklist físico com cabeçalho cinza (`#595959`) e assinaturas triplas.
- **Fidelidade 1:1 de PRINT 03 (ROMANEIO):** Implementado o modelo exato de "Substituição de Equipamento – Anexar ao Incidente" (TJMG GEOPE/COATE), com logo triangular TJMG em vetor, tabelas de retirada (Comarca ➔ Sala Polo) e inclusão (Sala Polo ➔ Comarca), campo de observações com fundo cinza claro (`#f0f1f3`), dados de matrícula e data por extenso no rodapé esquerdo.
- **Modo Folha em Branco 1:1:** O botão "Em Branco" gera exatamente o mesmo leiaute visual oficial das prints, com campos abertos e caixas desmarcadas prontas para preenchimento manual à caneta.
- **RN21 (Fidelidade Visual 1:1 dos Modelos de Impressão):** Nova regra de negócio proibindo qualquer desvio de estilo ou diagramação nos documentos.

### [0.4.0] — 2026-10-13
#### Adicionado (POP030 & Exportação Multicanal)
- **RN19 (POP030 — Script Padrão de Fechamento v3.5 - FEV/2025):** Mapeamento integral dos 14 tipos de fechamento de tarefas no HP Service Manager estabelecidos pela Gestão Wyntech/COMEQ (Acréscimo, Substituição com notação S:/I:, Instalação de peças/apps/licenças, Empréstimo, Remanejamento, Mudança Predial, Acompanhamento, Transporte, Recolhimento, Preventiva Escâner, Intervenção Switch, Remanejamento Predial, Ativação de Ponto e Vistoria com conferência de armário).
- **RN20 (Exportação Multicanal e Modo Contingência):** Suporte para Download PDF, Impressão Direta, Compartilhamento via WhatsApp e **Emissão de Folha/Documento em Branco** (para Laudo Normal, Laudo Rollout e Romaneio) para preenchimento manual em emergências no tribunal.

### [0.3.1] — 2026-10-13
#### Adicionado (Novas Diretrizes Operacionais)
- **RN15 (Usuário Ausente):** Proibição de suspensão do chamado; atualização obrigatória no HP com dados de quem informou e previsão de horário.
- **RN16 (Dados Cadastrais Wyntech):** Dados corporativos fixados (CNPJ, IE, IM e endereço BH) para cabeçalhos e geração documental.
- **RN17 (Fluxo de Cancelamento / Curadoria):** Script padronizado para solicitação de cancelamento no grupo de WhatsApp `CANCELAMENTO IN`.
- **RN18 (Erro de Recaptcha / Projudi / Proxy):** Procedimento de liberação no proxy via chamado HP pelas chefias autorizadas.

### [0.3.0] — 2026-10-13
#### Adicionado (Regras Operacionais Oficiais COATEC / Wyntech)
- **RN07 (Transferência Patrimonial Polo Divinópolis):** Padrão de abertura de tarefa no HP discriminando patrimônios e exigência de anexar somente o Romaneio.
- **RN08 (Modelo Idêntico de Desktops):** Proibição estrita de substituição por modelo divergente do incidente.
- **RN09 (Anti-descrição Genérica de Peças):** Obrigatório especificar a peça exata (ex: Adaptador HDMI para VGA, Cabo CAT6, etc.) e serial quando aplicável.
- **RN10 (Procedimento Teclados e Mouses):** Obrigatória limpeza/recuperação antes da troca de periféricos COPAT.
- **RN11 (Garantia Lenovo vs Daten):** Fluxo de reposição para o kit do técnico volante.
- **RN12 (Exceção Microfones e Caixas de Som):** Competência GEASE/COTESI via processo SEI; proibido recolher ou substituir diretamente.
- **RN13 (Procedimento de Caso Fortuito / Raio / Furto de Peça):** PROIBIDO substituir ou recolher; emissão de Laudo de Caso Fortuito, ciência do Administrador da Comarca e orientação via SEI para a COPAT.
- **RN14 (Compra Emergencial de Peças):** Modelo de e-mail padronizado para compras e envio de NF em PDF em até 24h.
- **Interface e Protótipo:** Adicionados seletores de peças específicas, gerador de tarefa de transferência patrimonial, alerta de caso fortuito e e-mail emergencial de compras.

### [0.2.1] — 2026-10-13
#### Refinado (Instruções Críticas do Analista)
- **Definição estrita dos Documentos Gerados:** Wyntech gera **exclusivamente**:
  1. *Laudo Normal* (Laudo Técnico de Verificação / Devolução)
  2. *Laudo de Rollout* (específico para o notebook antigo substituído)
  3. *Romaneio de Transporte* (lista consolidada de equipamentos para Sala Polo)
  4. *Mensagens Padronizadas de Fechamento*
- **Padronização da Mensagem de Rollout (TR de Notebooks):**
  `Foi realizado a substituição do computador: (S: [Patr. substituído] - I: [Patr. incluído] - [Nome do usuário] - [Nome do Setor])`
- **Mapeamento do Checklist Obrigatório de Rollout (Itens Externos Cobrados):**
  - Guia de Transferência (anexada na TR CHxxxxxx)
  - RAT_ROLLOUT
  - Foto obrigatória com **CHIP, SERIAL e PATRIMÔNIO** do notebook novo
  - Termo de Responsabilidade (**com alerta crítico: vale apenas com assinatura do Magistrado**)
- **Exclusão de geração de RAT do HP:** O sistema HP já gera o RAT nativamente; o Wyntech apenas lembra o técnico de imprimi-lo e colher a assinatura.

### [0.2.0] — 2026-10-13
#### Alterado & Adicionado
- **Análise profunda do HP Service Manager (TJMG):** Mapeamento do fluxo real de atendimento a partir de capturas de tela do sistema corporativo (IN, CH, aba MNS/SLA, aba Movimentação Patrimonial, Assistente de Fechamento com códigos oficiais e RAT oficial).
- **Separação documental:** Distinção explícita entre RAT Oficial (14 itens de checklist do TJMG), Laudo Técnico de Verificação (6 itens Wyntech), Termo de Responsabilidade e Romaneio.
- **Redefinição do conceito central:** Wyntech reposicionado como Ferramenta Pessoal / Canivete Suíço de Campo (Workflow, checklist guiado, geração de mensagens para o HP e guarda de histórico/fotos), e não como software concorrente de gestão de tickets.

### [0.1.0] — 2026-10-13
#### Adicionado
- Documento de arquitetura inicial (`architecture.md`)
- Plano do projeto com stack, modelo de dados, endpoints e fases
- Análise dos documentos: RAT/Laudo Técnico, Romaneio, Substituição de Equipamento

---

## 14. Decisões Técnicas (ADRs)

### ADR-001: Vanilla JS em vez de React/Vue/Angular
- **Data:** 2026-10-13
- **Status:** Aceita
- **Contexto:** Projeto hospedado em hosting compartilhado, precisa ser leve e de fácil manutenção.
- **Decisão:** Usar JavaScript vanilla com módulos ES6 e SPA router próprio.
- **Consequências:** O protótipo confirma a decisão: ~204 KB em um único HTML (CSS ~42 KB, HTML ~73 KB, JS ~89 KB), sem dependências de runtime, com build apenas de concatenação. A manutenção é direta.

### ADR-002: PHP para backend em vez de serverless/static
- **Data:** 2026-10-13
- **Status:** Aceita
- **Contexto:** Hosting compartilhado geralmente inclui PHP + MySQL gratuitamente.
- **Decisão:** API REST leve em PHP 8+ com PDO.
- **Consequências:** Funciona em qualquer hosting sem configuração extra, mas limita a linguagem server-side a PHP.

### ADR-003: Geração de PDF client-side com jsPDF
- **Data:** 2026-10-13
- **Status:** Aceita para produção; **não implementada no protótipo**
- **Contexto:** Gerar PDFs no servidor consumiria processamento e banda; hosting compartilhado tem recursos limitados.
- **Decisão:** Usar jsPDF no navegador para gerar os documentos no alvo de produção.
- **Consequências:** Zero carga no servidor, funciona offline, mas PDFs complexos exigem mais código JS para layout. O protótipo v0.7.0 usa HTML/CSS + `window.print()` e foi validado em A4; o PDF oficial com SIAD é gerado pelo Apps Script com `pdf-lib`. A escolha de jsPDF para o PDF local de produção permanece em aberto.

### ADR-004: Hash-based router (#/) em vez de History API
- **Data:** 2026-10-13
- **Status:** Aceita
- **Contexto:** History API requer configuração de server-side rewrite que nem todos os hostings suportam bem.
- **Decisão:** Usar hash-based routing (`#/chamados`, `#/chamados/novo`).
- **Consequências:** Funciona em qualquer servidor sem configuração, URLs menos "limpas" mas 100% confiáveis. Implementado no protótipo com 8 rotas hash.

### ADR-005: Coexistência com HP Service Manager (Copiloto de Campo)
- **Data:** 2026-10-13
- **Status:** Aceita
- **Contexto:** O HP Service Manager é o sistema obrigatório do tribunal, porém lento, complexo e hostil para uso em smartphone.
- **Decisão:** O Wyntech atua como interface operacional de campo do técnico volante. Ele não tenta replicar o HP nem se conectar via scraping arriscado: ele gera os textos prontos para copiar/colar no campo "Solução" do HP, entrega os laudos e o romaneio preenchidos (Laudo Técnico, Laudo de Rollout, Romaneio) e guarda o banco de dados seguro do analista. Os documentos externos (RAT do HP, RAT_ROLLOUT, Guia de Transferência e Termo de Responsabilidade) são apenas cobrados no checklist.
- **Consequências:** Independência de APIs fechadas do tribunal, risco de bloqueio zero, extrema agilidade para o analista na ponta.

### ADR-006: Integração com o gerador oficial via atalho + rascunho JSON
- **Data:** 2026-10-19
- **Status:** Aceita no protótipo; prefill automático pendente
- **Contexto:** O Web App oficial usa `google.script.run` (`buscarAtivo`, `salvarLaudo`), não expõe `doPost`/CORS e gera o PDF no cliente. Não há parâmetro de URL para pré-preencher o formulário.
- **Decisão:** Não alterar o Apps Script. O protótipo abre o gerador em outra aba e exporta um rascunho `{ versao: 1, dados: { ... } }` que o próprio gerador importa em **Abrir rascunho** (`fill(dados)`).
- **Consequências:** Integração sem risco de quebrar o script oficial e sem duplicar a consulta ao SIAD. O fluxo exige dois cliques adicionais (baixar rascunho e importar). O prefill em um clique exige alterar `doGet`/HTML do script ou usar `postMessage`; ver `docs/integracao-apps-script.md`.

---

## 15. Pendências e Dúvidas

> Seção atualizada conforme novas informações forem recebidas do usuário.

### Itens em Aberto

| # | Item | Status | Impacto |
|---|------|--------|---------|
| P01 | Lista completa de comarcas atendidas | 🟡 Aguardando | Seed do banco |
| P02 | Modelo completo do Romaneio | ✅ Resolvido | Modelo e impressão validados no protótipo (§8.1; `docs/conformidade-documental.md`) |
| P03 | Regras de negócio detalhadas (campos obrigatórios, validações) | 🟡 Aguardando | Formulários + API |
| P04 | Dados do técnico para auto-preenchimento (nome, matrícula) | 🟡 Aguardando | Perfil de usuário |
| P05 | Multi-usuário ou uso pessoal? | 🟡 Aguardando | Arquitetura auth |
| P06 | Hosting específico (Hostinger, HostGator, Locaweb?) | 🟡 Aguardando | Config de deploy |
| P07 | Outros documentos que precisam ser gerados | 🟡 Aguardando | Templates PDF |
| P08 | Integração com SIAD | 🟡 Parcial | O gerador oficial consulta o SIAD; o protótipo não consulta. Integração no app de produção pendente. |
| P09 | Fluxo completo do Romaneio | ✅ Resolvido no protótipo | Modelo e impressão validados; produção pendente |
| P10 | Transições de status permitidas para chamados | 🟡 Aguardando | State machine |
| P11 | Prefill automático do gerador oficial | ⬜ Planejado | Requer alterar `doGet`/HTML do Apps Script; ver `docs/integracao-apps-script.md` |
| P12 | Logos oficiais dos documentos | 🟡 Aguardando assets | Aplicar os arquivos TJMG/Wyntech na produção |
| P13 | Backend/auth/PWA | ⬜ Não iniciado | Fora do escopo do protótipo |
| P14 | Restringir acesso ao Web App oficial | 🟡 Pendente | Antes de usar dados reais; revisar “Executar como” |

---

## 16. Referências

| Recurso | Link / Descrição |
|---------|------------------|
| Documentação do projeto | `README.md`, `CHANGELOG.md`, `docs/integracao-apps-script.md`, `docs/conformidade-documental.md` |
| Capturas e PDFs | `docs/capturas/`, `docs/exemplos/` |
| Google Apps Script | https://developers.google.com/apps-script |
| pdf-lib (gerador oficial) | https://pdf-lib.js.org/ |
| pdf.js (prévia do gerador oficial) | https://mozilla.github.io/pdf.js/ |
| jsPDF Docs | https://github.com/parallax/jsPDF |
| Compressor.js | https://github.com/fengyuanchen/compressorjs |
| PWA Docs | https://web.dev/progressive-web-apps/ |
| IndexedDB API | https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API |
| Repositório | https://github.com/Relod/WynTech_field_system |

---

> **📌 Este documento é a fonte da verdade do projeto. Toda alteração significativa deve ser registrada aqui.**
