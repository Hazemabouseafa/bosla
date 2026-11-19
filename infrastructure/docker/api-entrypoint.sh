#!/usr/bin/env sh
set -eu

MEDIA_DIR="${MEDIA_ROOT:-/var/bosla/media}"

mkdir -p \
  "${MEDIA_DIR}/uploads-tmp" \
  "${MEDIA_DIR}/sources" \
  "${MEDIA_DIR}/hls" \
  "${MEDIA_DIR}/attachments" \
  "${MEDIA_DIR}/thumbnails"

if [ "$(id -u)" = "0" ]; then
  if [ "$(stat -c '%u' "${MEDIA_DIR}" 2>/dev/null || echo 0)" != "1000" ]; then
    chown -R node:node "${MEDIA_DIR}"
  fi

  if [ "${SKIP_DB_MIGRATIONS:-false}" != "true" ]; then
    echo "[bosla-api] Running Prisma migrations (migrate deploy)..."
    gosu node node ./node_modules/prisma/build/index.js migrate deploy --schema=packages/db/prisma/schema.prisma
  fi

  echo "[bosla-api] Starting NestJS API as non-root user (node)..."
  exec gosu node node apps/api/dist/main.js
fi

if [ "${SKIP_DB_MIGRATIONS:-false}" != "true" ]; then
  echo "[bosla-api] Running Prisma migrations (migrate deploy)..."
  node ./node_modules/prisma/build/index.js migrate deploy --schema=packages/db/prisma/schema.prisma
fi

echo "[bosla-api] Starting NestJS API..."
exec node apps/api/dist/main.js
