'use strict';

const http = require('node:http');
const { loadConfig } = require('./config');
const { openDatabase, runMigrations, closeDatabase } = require('./db');
const { createApp } = require('./app');

const config = loadConfig();
const db = openDatabase(config.dbPath);
const migrations = runMigrations(db, config.migrationsDir);

const app = createApp({ db, config });
const server = http.createServer(app);

server.listen(config.port, config.host, () => {
  const users = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total;
  console.log(`Wyntech Campo TJMG v${config.version}`);
  console.log(`Ambiente: ${config.env}`);
  console.log(`Servidor: http://${config.host}:${config.port}`);
  console.log(`Banco: ${config.dbPath}`);
  if (migrations.length) console.log(`Migrações aplicadas: ${migrations.join(', ')}`);
  if (users === 0) {
    console.warn('Nenhum usuário cadastrado. Execute `npm run db:seed` para criar o acesso inicial.');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${config.port} já está em uso. Defina PORT no .env.`);
  } else {
    console.error(error);
  }
  closeDatabase(db);
  process.exitCode = 1;
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} recebido; encerrando...`);
  server.close(() => {
    closeDatabase(db);
    process.exit(0);
  });
  setTimeout(() => {
    closeDatabase(db);
    process.exit(1);
  }, 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { server, db, config };
