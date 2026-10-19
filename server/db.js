'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  return db;
}

function runMigrations(db, migrationsDir) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migracoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arquivo TEXT NOT NULL UNIQUE,
      aplicado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT arquivo FROM _migracoes').all().map((row) => row.arquivo)
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const executed = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO _migracoes (arquivo) VALUES (?)').run(file);
      db.exec('COMMIT;');
      executed.push(file);
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        // A transação pode ter sido encerrada pelo próprio SQLite.
      }
      throw new Error(`Falha na migração ${file}: ${error.message}`);
    }
  }

  return executed;
}

function closeDatabase(db) {
  if (!db) return;
  try {
    db.close();
  } catch {
    // Encerramento idempotente.
  }
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  openDatabase,
  runMigrations,
  closeDatabase,
  nowIso,
};
