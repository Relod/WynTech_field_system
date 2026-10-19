'use strict';

const fs = require('node:fs');
const { loadConfig } = require('../server/config');
const { openDatabase, runMigrations, closeDatabase } = require('../server/db');
const { seedDatabase } = require('../server/seed');

async function main() {
  const config = loadConfig();
  if (config.isProduction) {
    throw new Error('db:reset não é permitido com NODE_ENV=production.');
  }

  if (config.dbPath !== ':memory:') {
    for (const suffix of ['', '-shm', '-wal']) {
      const file = `${config.dbPath}${suffix}`;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }

  const db = openDatabase(config.dbPath);
  try {
    runMigrations(db, config.migrationsDir);
    const result = await seedDatabase(db, config.seed);
    console.log(`Banco recriado em ${config.dbPath}`);
    console.log(`Admin: ${result.admin.email}`);
    console.log(`Técnico: ${result.tecnico.email}`);
    console.log(`Comarcas: ${result.comarcasTotal}`);
    console.log('ATENÇÃO: reset apagou todos os dados locais.');
  } finally {
    closeDatabase(db);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
