#!/usr/bin/env bash
set -euo pipefail

MEDIA_ROOT="${MEDIA_ROOT:-/var/bosla/media}"
BACKUP_DEST="${BACKUP_DEST:-/var/bosla/backups/media}"

mkdir -p "${BACKUP_DEST}"
rsync -a --delete --exclude="uploads-tmp/" "${MEDIA_ROOT}/" "${BACKUP_DEST}/"
echo "Media volume synchronized to ${BACKUP_DEST}"
