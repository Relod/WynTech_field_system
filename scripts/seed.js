'use strict';

const { loadConfig } = require('../server/config');
const { openDatabase, runMigrations, closeDatabase } = require('../server/db');
const { seedDatabase } = require('../server/seed');

async function main() {
  const config = loadConfig();
  const db = openDatabase(config.dbPath);
  try {
    runMigrations(db, config.migrationsDir);
    const result = await seedDatabase(db, config.seed);
    console.log(`Banco: ${config.dbPath}`);
    console.log(
      result.admin.created
        ? `Admin criado: ${result.admin.email}`
        : `Admin já existente: ${result.admin.email}`
    );
    console.log(
      result.tecnico.created
        ? `Técnico criado: ${result.tecnico.email}`
        : `Técnico já existente: ${result.tecnico.email}`
    );
    console.log(`Comarcas: ${result.comarcasTotal} (${result.comarcasCreated} criadas agora)`);
    if (result.admin.created || result.tecnico.created) {
      console.log('Senhas iniciais definidas por SEED_ADMIN_PASSWORD/SEED_TECNICO_PASSWORD.');
      console.log('Troque as senhas antes de usar com dados reais.');
    }
  } finally {
    closeDatabase(db);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
