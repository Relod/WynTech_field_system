#!/usr/bin/env bash
# Backup lógico do SQLite do Wyntech, seguro com a aplicação em execução.
# Instale como /usr/local/sbin/wyntech-backup e agende pelo systemd.
set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-/opt/wyntech}"
DB_PATH="${DB_PATH:-/var/lib/wyntech/wyntech.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/wyntech}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
NODE_BIN="${NODE_BIN:-/usr/bin/node}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

case "$RETENTION_DAYS" in
  ''|*[!0-9]*)
    echo "RETENTION_DAYS deve ser um inteiro positivo." >&2
    exit 1
    ;;
esac
if [ "$RETENTION_DAYS" -lt 1 ]; then
  echo "RETENTION_DAYS deve ser pelo menos 1." >&2
  exit 1
fi

if [ ! -x "$NODE_BIN" ]; then
  echo "Node não encontrado em $NODE_BIN." >&2
  exit 1
fi
if [ ! -f "$DB_PATH" ]; then
  echo "Banco não encontrado em $DB_PATH." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/wyntech-$STAMP.sqlite"

cd "$APP_DIR"
DB_PATH="$DB_PATH" BACKUP_FILE="$BACKUP_FILE" "$NODE_BIN" <<'NODE'
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const source = process.env.DB_PATH;
const target = process.env.BACKUP_FILE;
if (!fs.existsSync(source)) {
  console.error(`Banco não encontrado: ${source}`);
  process.exit(1);
}

const db = new DatabaseSync(source);
try {
  db.exec('PRAGMA busy_timeout = 5000');
  const escaped = target.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escaped}'`);
  console.log(`Snapshot criado: ${target}`);
} finally {
  db.close();
}
NODE

gzip -9 "$BACKUP_FILE"
sha256sum "$BACKUP_FILE.gz" > "$BACKUP_FILE.gz.sha256"
chmod 600 "$BACKUP_FILE.gz" "$BACKUP_FILE.gz.sha256"

if [ -n "$RCLONE_REMOTE" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "RCLONE_REMOTE configurado, mas o rclone não está instalado." >&2
    exit 1
  fi
  rclone copy "$BACKUP_FILE.gz" "$RCLONE_REMOTE"
  rclone copy "$BACKUP_FILE.gz.sha256" "$RCLONE_REMOTE"
  echo "Cópia externa enviada para $RCLONE_REMOTE."
fi

find "$BACKUP_DIR" -type f -name 'wyntech-*.sqlite.gz*' -mtime +"$RETENTION_DAYS" -delete
echo "Backup concluído: $BACKUP_FILE.gz"
