#!/usr/bin/env bash
# Nightly pg_dump of the k3s Postgres pod; same layout and pruning as vm-backup.sh.
set -euo pipefail

backup_dir="${BACKUP_DIR:-/srv/cycleline/backups}"
mkdir -p "$backup_dir"

tmp="$backup_dir/.dump-$$.tmp"
final="$backup_dir/$(date +%F).sql.gz"
trap 'rm -f "$tmp"' EXIT

sudo k3s kubectl -n cycleline exec -i postgres-0 -- \
  pg_dump -U cycleline cycleline | gzip > "$tmp"

mv "$tmp" "$final"
find "$backup_dir" -name '*.sql.gz' -mtime +14 -delete
