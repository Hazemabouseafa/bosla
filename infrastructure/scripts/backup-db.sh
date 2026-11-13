#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/bosla/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${BACKUP_DIR}/bosla_academy_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
pg_dump "${DATABASE_URL:?DATABASE_URL must be set}" --no-owner --no-privileges | gzip -9 > "${OUT_FILE}"
chmod 600 "${OUT_FILE}"

find "${BACKUP_DIR}" -name "bosla_academy_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete
echo "Backup created: ${OUT_FILE}"
