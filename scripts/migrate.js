'use strict';

const { loadConfig } = require('../server/config');
const { openDatabase, runMigrations, closeDatabase } = require('../server/db');

const config = loadConfig();
const db = openDatabase(config.dbPath);

try {
  const applied = runMigrations(db, config.migrationsDir);
  console.log(`Banco: ${config.dbPath}`);
  console.log(
    applied.length
      ? `Migrações aplicadas: ${applied.join(', ')}`
      : 'Banco já está atualizado; nenhuma migração pendente.'
  );
} finally {
  closeDatabase(db);
}
