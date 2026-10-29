#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

backup_dir="${BACKUP_DIR:-/srv/cycleline/backups}"
mkdir -p "$backup_dir"

tmp="$backup_dir/.dump-$$.tmp"
final="$backup_dir/$(date +%F).sql.gz"
trap 'rm -f "$tmp"' EXIT

docker compose -f compose.yaml -f compose.vm.yaml --env-file .env.vm \
  exec -T database pg_dump -U cycleline cycleline | gzip > "$tmp"

mv "$tmp" "$final"
find "$backup_dir" -name '*.sql.gz' -mtime +14 -delete
