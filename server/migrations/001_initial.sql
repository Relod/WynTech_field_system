-- Wyntech Campo TJMG — esquema inicial do MVP (SQLite)
-- Datas em ISO 8601 UTC (TEXT) para manter o contrato da API estável.

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  senha_hash TEXT NOT NULL,
  matricula TEXT,
  cargo TEXT NOT NULL DEFAULT 'Técnico',
  papel TEXT NOT NULL DEFAULT 'TECNICO' CHECK (papel IN ('TECNICO', 'ADMIN')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS comarcas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  cidade TEXT,
  endereco TEXT,
  ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS chamados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  comarca_id INTEGER NOT NULL REFERENCES comarcas(id) ON DELETE RESTRICT,
  numero_os TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('IN', 'TR', 'REQ')),
  setor TEXT,
  pessoa_contato TEXT,
  matricula_contato TEXT,
  telefone_contato TEXT,
  defeito_relatado TEXT,
  solucao_aplicada TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ANDAMENTO', 'FINALIZADO')),
  data_atendimento TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  excluido_em TEXT
);

CREATE TABLE IF NOT EXISTS equipamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  patrimonio TEXT,
  serial TEXT,
  tipo_equipamento TEXT,
  modelo TEXT,
  fabricante TEXT,
  acao TEXT NOT NULL CHECK (acao IN ('VERIFICACAO', 'RETIRADA', 'INSTALACAO', 'TROCA')),
  tipo_movimentacao TEXT CHECK (
    tipo_movimentacao IS NULL OR tipo_movimentacao IN ('MANUTENCAO', 'DEVOLUCAO')
  ),
  local_verificacao TEXT,
  local_retirada TEXT,
  local_entrega TEXT DEFAULT 'Sala Polo Divinópolis',
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS checklist_verificacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipamento_id INTEGER NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  avaliacao_wyntech TEXT CHECK (
    avaliacao_wyntech IS NULL OR avaliacao_wyntech IN ('BOM', 'REGULAR', 'RUIM')
  ),
  avaliacao_tjmg TEXT CHECK (
    avaliacao_tjmg IS NULL OR avaliacao_tjmg IN ('BOM', 'REGULAR', 'RUIM')
  ),
  observacao TEXT
);

CREATE TABLE IF NOT EXISTS acessorios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipamento_id INTEGER NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  presente INTEGER NOT NULL DEFAULT 0 CHECK (presente IN (0, 1)),
  descricao_outros TEXT
);

CREATE TABLE IF NOT EXISTS trocas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  equip_retirado_id INTEGER REFERENCES equipamentos(id) ON DELETE SET NULL,
  equip_instalado_id INTEGER REFERENCES equipamentos(id) ON DELETE SET NULL,
  local_retirada TEXT,
  local_entrega TEXT DEFAULT 'Sala Polo Divinópolis',
  data_troca TEXT,
  observacoes TEXT,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  equipamento_id INTEGER REFERENCES equipamentos(id) ON DELETE SET NULL,
  caminho_arquivo TEXT NOT NULL,
  descricao TEXT,
  tamanho_bytes INTEGER,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS documentos_gerados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  tipo_doc TEXT NOT NULL CHECK (tipo_doc IN ('LAUDO', 'LAUDO_ROLLOUT', 'ROMANEIO')),
  gerado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  dados_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  jti TEXT NOT NULL UNIQUE,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_em TEXT NOT NULL,
  revogado_em TEXT,
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_chamados_usuario ON chamados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_chamados_comarca ON chamados(comarca_id);
CREATE INDEX IF NOT EXISTS idx_chamados_numero_os ON chamados(numero_os);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados(status);
CREATE INDEX IF NOT EXISTS idx_chamados_data ON chamados(data_atendimento);
CREATE INDEX IF NOT EXISTS idx_equipamentos_chamado ON equipamentos(chamado_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_patrimonio ON equipamentos(patrimonio);
CREATE INDEX IF NOT EXISTS idx_equipamentos_serial ON equipamentos(serial);
CREATE INDEX IF NOT EXISTS idx_trocas_chamado ON trocas(chamado_id);
CREATE INDEX IF NOT EXISTS idx_fotos_chamado ON fotos(chamado_id);
CREATE INDEX IF NOT EXISTS idx_documentos_chamado ON documentos_gerados(chamado_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em);
