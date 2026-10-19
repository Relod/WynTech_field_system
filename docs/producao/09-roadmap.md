# 09 — Roadmap

## Estado em 19/10/2026

Concluído:

- Protótipo aprovado v0.7.0 com 8 telas e documentos A4 validados.
- MVP real v0.8.0: Node/SQLite, autenticação, API, chamados, equipamentos,
  trocas, documentos, dashboard, perfil e testes.
- Documentação de produção e ADRs.
- Capturas finais do MVP em desktop e mobile.

## Prioridade 1 — Colocar em produção com segurança

1. **Definir a hospedagem** compatível com Node 24 e disco persistente.
2. **Trocar senhas e segredos**, desativar usuários de teste.
3. **Restringir o Apps Script** ao domínio TJMG e revisar “Executar como”.
4. **Configurar backup automático** com teste de restauração.
5. **Adicionar logos oficiais** TJMG/Wyntech e revisar a marca.
6. **Validar a URL oficial** no ambiente de produção.
7. **Monitorar** `/api/health`, erros e uso de disco.

Critério de saída: checklist de go-live de
[06 — Deploy](06-deploy-hospedagem.md) completa.

## Prioridade 2 — Fechar lacunas do atendimento

### Administração de usuários

- Tela de listagem/criação/desativação de usuários (ADMIN).
- Reset de senha controlado e revogação de sessões.
- Auditoria de reatribuição de chamados.

### Fotos e anexos

- Upload com validação de tipo/tamanho e armazenamento fora do SQLite.
- Vínculo com chamado/equipamento.
- Exclusão e retenção.
- A tabela `fotos` já existe; faltam endpoint e UI.

### Checklist/acessórios do laudo

- Edição de `checklist_verificacao` e `acessorios` no detalhe.
- Reflexo no rascunho oficial.
- Validação de campos obrigatórios por tipo de documento.

### Edição completa do chamado

- Tela de edição além de status/solução, com histórico de alterações.
- Anexos e observações com controle de acesso.

## Prioridade 3 — Documentos e integração

1. **Avaliar a portabilidade do A4** para o console, caso o Apps Script deixe de
   ser a fonte oficial. O protótipo tem os templates e a impressão validada.
2. **Importação assistida do rascunho** sem copiar/colar (sempre respeitando o
   Apps Script atual).
3. **Validação do schema do rascunho** no servidor.
4. **Numeração/versionamento de documentos** e histórico de gerações.
5. **Download do snapshot** para auditoria.

Qualquer mudança no Apps Script exige decisão separada: o MVP atual não altera
`google.script.run`, `buscarAtivo`, `salvarLaudo` ou o PDF do cliente.

## Prioridade 4 — Qualidade e operação

- Testes E2E de navegador (Playwright) para login, chamado e perfil.
- Testes de acessibilidade automatizados.
- Testes de concorrência/backup do SQLite.
- Logs estruturados com request id e métricas.
- Rotina de expurgo/retenção conforme LGPD.
- Migração para PostgreSQL/MySQL se houver múltiplas instâncias.
- Pipeline de CI (testes + verificação de sintaxe + build do protótipo).

## Fora de escopo por enquanto

- App nativo, PWA offline e sincronização.
- Assinatura digital e PDF local no console.
- Integração automática com sistemas do TJMG.
- MFA (avaliar depois da hospedagem).
- Multi-tenant.

## Como priorizar

Use o impacto operacional e o risco:

1. Segurança/dados reais e disponibilidade.
2. Fluxo diário do técnico (chamado, equipamento, troca, documento).
3. Rastreabilidade e auditoria.
4. Conveniência e integrações.

Toda entrega deve atualizar README, CHANGELOG, docs afetados e testes.
