'use strict';

const { hashPassword } = require('./auth');

const COMARCAS = [
  { nome: 'Pará de Minas', cidade: 'Pará de Minas' },
  { nome: 'Divinópolis', cidade: 'Divinópolis' },
  { nome: 'Belo Horizonte', cidade: 'Belo Horizonte' },
  { nome: 'Contagem', cidade: 'Contagem' },
  { nome: 'Betim', cidade: 'Betim' },
  { nome: 'Sete Lagoas', cidade: 'Sete Lagoas' },
  { nome: 'Itaúna', cidade: 'Itaúna' },
  { nome: 'Formiga', cidade: 'Formiga' },
];

async function ensureUser(db, { nome, email, password, matricula, cargo, papel }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(normalizedEmail);
  if (existing) return { created: false, id: existing.id, email: normalizedEmail };

  const senhaHash = await hashPassword(password);
  const result = db
    .prepare(
      `INSERT INTO usuarios (nome, email, senha_hash, matricula, cargo, papel)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(nome, normalizedEmail, senhaHash, matricula, cargo, papel);

  return { created: true, id: Number(result.lastInsertRowid), email: normalizedEmail };
}

async function seedDatabase(db, seed) {
  const admin = await ensureUser(db, {
    nome: 'Administrador Wyntech',
    email: seed.adminEmail,
    password: seed.adminPassword,
    matricula: 'WYN-0001',
    cargo: 'Administrador',
    papel: 'ADMIN',
  });

  const tecnico = await ensureUser(db, {
    nome: 'Técnico de Campo',
    email: seed.tecnicoEmail,
    password: seed.tecnicoPassword,
    matricula: 'WYN-1044',
    cargo: 'Analista de Suporte',
    papel: 'TECNICO',
  });

  let comarcasCreated = 0;
  for (const comarca of COMARCAS) {
    const result = db
      .prepare('INSERT OR IGNORE INTO comarcas (nome, cidade) VALUES (?, ?)')
      .run(comarca.nome, comarca.cidade);
    if (result.changes > 0) comarcasCreated += 1;
  }

  return {
    admin,
    tecnico,
    comarcasCreated,
    comarcasTotal: db.prepare('SELECT COUNT(*) AS total FROM comarcas').get().total,
  };
}

module.exports = { seedDatabase, COMARCAS };
