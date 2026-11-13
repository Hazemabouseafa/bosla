#!/usr/bin/env bash
set -euo pipefail

MEDIA_ROOT="${MEDIA_ROOT:-/var/bosla/media}"
THRESHOLD="${DISK_ALERT_THRESHOLD_PERCENT:-85}"

USAGE_PCT="$(df -P "${MEDIA_ROOT}" | awk 'NR==2 {gsub("%", "", $5); print $5}')"
echo "Media volume (${MEDIA_ROOT}) disk usage: ${USAGE_PCT}% (threshold: ${THRESHOLD}%)"

if [ "${USAGE_PCT}" -ge "${THRESHOLD}" ]; then
  echo "ALERT: Disk usage ${USAGE_PCT}% exceeded threshold ${THRESHOLD}%!" >&2
  exit 2
fi
