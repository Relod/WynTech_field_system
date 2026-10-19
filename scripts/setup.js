'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');

function createEnvFile() {
  if (fs.existsSync(envPath)) {
    console.log('.env já existe; mantendo as configurações atuais.');
    return false;
  }

  const secret = crypto.randomBytes(32).toString('hex');
  const content = `# Wyntech Campo TJMG — gerado por npm run setup
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
DB_PATH=./data/wyntech.sqlite
AUTH_SECRET=${secret}
TOKEN_TTL_SECONDS=43200
COOKIE_SECURE=false
OFFICIAL_LAUDO_URL=
SEED_ADMIN_EMAIL=admin@wyntech.local
SEED_ADMIN_PASSWORD=Wyntech@2026
SEED_TECNICO_EMAIL=tecnico@wyntech.local
SEED_TECNICO_PASSWORD=Wyntech@2026
`;
  fs.writeFileSync(envPath, content, 'utf8');
  console.log('.env criado com AUTH_SECRET aleatório.');
  return true;
}

async function main() {
  createEnvFile();

  // Recarrega a configuração depois de criar o .env.
  const { loadConfig } = require('../server/config');
  const { openDatabase, runMigrations, closeDatabase } = require('../server/db');
  const { seedDatabase } = require('../server/seed');

  const config = loadConfig();
  const db = openDatabase(config.dbPath);
  try {
    runMigrations(db, config.migrationsDir);
    const result = await seedDatabase(db, config.seed);
    console.log(`Banco pronto em ${config.dbPath}`);
    console.log(`Admin: ${result.admin.email}`);
    console.log(`Técnico: ${result.tecnico.email}`);
    console.log(`Comarcas: ${result.comarcasTotal}`);
    console.log('');
    console.log('Credenciais iniciais (definidas no .env):');
    console.log(`  Admin:   ${config.seed.adminEmail} / ${config.seed.adminPassword}`);
    console.log(`  Técnico: ${config.seed.tecnicoEmail} / ${config.seed.tecnicoPassword}`);
    console.log('Troque essas senhas antes de usar com dados reais.');
    console.log('');
    console.log('Inicie com: npm run dev');
  } finally {
    closeDatabase(db);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
