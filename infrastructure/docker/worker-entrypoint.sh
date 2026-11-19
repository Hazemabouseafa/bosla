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

  echo "[bosla-worker] Starting BullMQ/FFmpeg worker as non-root user (node)..."
  exec gosu node node apps/worker/dist/main.js
fi

echo "[bosla-worker] Starting BullMQ/FFmpeg worker..."
exec node apps/worker/dist/main.js
