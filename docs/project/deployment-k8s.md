# Deployment: k3s + Cloudflare Tunnel

## Purpose
API + Postgres on the single-node k3s cluster on the Ubuntu server; the frontend runs on Vercel. Replaces the Docker Compose setup in [deployment-vm.md](deployment-vm.md) (kept as a fallback). Repo rules: [`AGENTS.md`](../../AGENTS.md).

## Key files
- `k8s/` → Kustomize: namespace `cycleline`, ConfigMap `cycleline-config`, Postgres StatefulSet (`local-path` PVC), backend Deployment + ClusterIP Service
- `scripts/k8s-deploy.sh` → build image on the node, import into k3s containerd, create Secret `cycleline-private` from `.env.vm`, apply, render Apache vhost
- `deploy/apache/cycleline-api.conf.template` → vhost on `127.0.0.1:8081` for `API_HOSTNAME`
- `scripts/k8s-backup.sh` → `pg_dump` from `postgres-0` + 14-day prune

## How it works
```
Browser → Vercel (Next.js) ──server-side──▶ https://<API_HOSTNAME>/api
  Cloudflare Tunnel (cloudflared, remotely managed) → Apache 127.0.0.1:8081 (vhost by Host)
  → Service backend (ClusterIP :8080) → Pod backend → Service postgres → postgres-0
```
1. `.env.vm` on the server: `APP_KEY`, `POSTGRES_PASSWORD`, `API_HOSTNAME`, `APP_URL=https://<API_HOSTNAME>`.
2. `scripts/k8s-deploy.sh` (needs sudo, Docker, k3s). Re-run after every pull; it rebuilds and restarts the backend.
3. Cloudflare Zero Trust → Networks → Tunnels → the server's tunnel → Public hostname: `<API_HOSTNAME>` → `http://127.0.0.1:8081`.
4. Vercel: root directory `frontend/`; env `AUTH_SECRET` (random) and `BACKEND_URL=https://<API_HOSTNAME>/api` (no `NEXT_PUBLIC_`).
5. Backups, as cron for a user with passwordless sudo:
   ```
   15 2 * * * /home/lazar/projects/cycleline/scripts/k8s-backup.sh >> /srv/cycleline/backups/backup.log 2>&1
   ```

## Restore
```bash
gunzip -c <file>.sql.gz | sudo k3s kubectl -n cycleline exec -i postgres-0 -- psql -U cycleline cycleline
```
Restore into an empty database before the backend first starts (migrations would otherwise create the tables).

## Gotchas
- `SEED_DATABASE` is `"false"` in the ConfigMap; seeding restores the public demo passwords. For demo data on a fresh cluster: `sudo k3s kubectl -n cycleline exec deploy/backend -- php artisan db:seed --force`, then rotate the passwords.
- Setting passwords from tinker needs `Hash::make(...)`; the `User` model does not hash on assignment.
- The image is `cycleline-backend:local` with `imagePullPolicy: Never`: it exists only in the node's containerd.
- The Apache vhost points at the Service ClusterIP; deleting and recreating the Service changes it → re-run `k8s-deploy.sh`.
- One backend replica: the auth rate limiter uses the pod's file cache.
- Data lives in the `postgres-data-postgres-0` PVC (`local-path`, reclaim `Delete`): deleting the PVC or namespace deletes the data.
