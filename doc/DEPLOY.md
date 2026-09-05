# Migrating from Heroku + Atlas to a DigitalOcean droplet

Target: one droplet running three containers under plain `docker compose` —
Caddy for TLS, the app pulled prebuilt from GHCR, and MongoDB on a named
volume. No PaaS layer.

The app writes nothing to disk at runtime, so the container is disposable and
MongoDB is the only stateful thing in the system. That makes the database
cutover the only step with real risk.

## Why not Dokploy

Dokploy was the original plan and it works, but its control plane runs its own
Postgres, Redis, Traefik and dashboard — roughly **500–700 MB of RAM**, against
about **150 MB** for Docker plus Caddy. On a 2 GiB droplet shared with MongoDB
that is the difference between comfortable and tight, and it buys a web UI and
one-click rollbacks that a site deployed occasionally does not need.

What is genuinely lost, and how it is replaced here:

| Dokploy feature | Replacement |
|---|---|
| Web UI for deploys | `docker compose pull && up -d`, automated from GitHub Actions |
| One-click rollback | `IMAGE_TAG=sha-<commit>` in `.env`, then `up -d` |
| Scheduled DB backups | `deploy/backup.sh` on cron |
| Let's Encrypt automation | Caddy, which does it natively with no cron |
| Container logs / restart / stats UI | Portainer CE, measured at ~17 MB |

Measured footprints: app container **~51 MB**, Mongo (empty) **~98 MB**,
Portainer **~17 MB**.

---

## 0. Before you start

The image is already built and published — `.github/workflows/deploy.yml` runs
on GitHub's native amd64 runners and pushes to GHCR. The droplet never builds
anything, which matters: `npm ci` pulls ~550 MB of devDependencies and terser
runs over 5 MB of JS, neither of which belongs next to a live database on a
1 vCPU box.

Make the GHCR package pullable. Either flip it to public on the package's
settings page, or create a PAT with `read:packages` and log the droplet in:

```bash
echo '<PAT>' | docker login ghcr.io -u ncrouzier --password-stdin
```

---

## 1. Droplet

**2 GiB / 1 vCPU ($12/mo) is viable** with this stack, because nothing is built
on the box. 4 GiB is more comfortable if the club site grows.

Ubuntu 24.04 LTS, in NYC or TOR for Maryland members. Then:

```bash
ssh root@<droplet-ip>

# Docker
curl -fsSL https://get.docker.com | sh

# Swap, as insurance against memory spikes
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Firewall. No dashboard port to open — that is one of the wins here.
ufw allow OpenSSH && ufw allow 80 && ufw allow 443
ufw --force enable
```

---

## 2. Stack files

```bash
mkdir -p /opt/mcrrc && cd /opt/mcrrc
# Copy deploy/docker-compose.yml, deploy/Caddyfile, deploy/env.example and
# deploy/backup.sh from the repo, then:
cp env.example .env && chmod 600 .env
```

Fill in `.env`. Notes on the fields that matter:

- `SESSION_SECRET` — carry over from Heroku **unchanged**, or the whole club is
  logged out.
- `MONGO_PASSWORD` — `openssl rand -hex 24`. Use **hex, not base64**: the value
  is interpolated into a `mongodb://` URI, where `: / ? # [ ] @` must be
  percent-encoded, and base64 routinely emits `/`. The failure looks like a
  wrong password rather than a malformed URI, so it is a slow one to debug.
- `SITE_DOMAIN` / `ACME_EMAIL` — Caddy uses these to obtain the certificate.
- `IMAGE_TAG` — leave at `latest` normally; set to a `sha-` tag to roll back.
- Do **not** set `DYNO`, `MLAB_MONGODB_DB_URL` or `OPENSHIFT_MONGODB_DB_URL`:
  they are legacy branches in `server.js` and would divert the connection away
  from `MONGODB_URI`.

`MONGODB_URI` and `TRUST_PROXY_HOPS` are composed in `docker-compose.yml`, not
set in `.env`. `TRUST_PROXY_HOPS=1` is not optional — without it every request
looks like it came from Caddy, and the per-IP rate limits on login, signup and
the public application form apply to all users collectively.

Bring it up **before** pointing DNS at it, so a failure is private:

```bash
docker compose up -d
docker compose ps
docker compose logs -f app
```

Mongo publishes no ports, so it is reachable only from the compose network. To
connect from your laptop, tunnel: `ssh -L 27017:localhost:27017 root@<ip>`.

### Portainer

Portainer gives back the container UI a PaaS would have provided — logs,
restart, `exec`, live memory and CPU per container, volume browsing — for about
17 MB.

It is bound to `127.0.0.1:9000`, not published. **This matters**: a container
with the Docker socket mounted is effectively root on the droplet, so it must
never be exposed. Reach it the same way as Mongo:

```bash
ssh -L 9000:localhost:9000 root@<droplet-ip>
# then open http://localhost:9000
```

On first start Portainer generates a one-time **setup token** and prints it to
its own logs. The setup screen will not let you create the admin user without
it — proving you can read the host's logs is what stops a passer-by from
claiming the instance:

```bash
docker compose logs portainer | grep setup_token
```

If that returns nothing the log has rotated past it. The token is generated
once, when the database is initialised, so start that database over — nothing
is lost before you have configured anything:

```bash
docker compose down portainer
docker volume ls                          # find the real name
docker volume rm <stack>_portainer_data
docker compose up -d portainer
docker compose logs portainer | grep setup_token
```

Note the socket is deliberately **not** mounted `:ro`. That flag does not
restrict the Docker API — it only affects the socket file — so using it would
suggest a protection that is not there. The loopback binding is the real
control.

If you would rather run nothing extra at all, `lazydocker` over SSH gives most
of the same view on demand and leaves nothing resident.

---

## 3. Data migration

Nothing needs installing on the droplet: `mongodb-database-tools` is not in
Ubuntu's repos (it lives in MongoDB's own apt repo), but the `mongo:7` image
already ships `mongodump`, `mongorestore` and `mongosh`. Run them in a
throwaway container, which also guarantees the tool version matches the server.

```bash
# From Atlas, onto the droplet. --archive writes to stdout, so the dump lands
# on the host without mounting anything into the container.
docker run --rm mongo:7 mongodump \
  --uri="<atlas-connection-string>" --archive --gzip > /root/atlas.archive

# Into the running Mongo container
docker compose exec -T mongo mongorestore \
  --uri="mongodb://<MONGO_USER>:<MONGO_PASSWORD>@localhost:27017/?authSource=admin" \
  --archive --gzip < /root/atlas.archive
```

Verify before cutting over:

```bash
# The system.* filter is not optional. getCollectionNames() lists system.views
# once the database has any views, and countDocuments() runs an aggregate,
# which not even the root user is permitted on a system collection. Unfiltered,
# the loop throws partway through — leaving a partial count that reads like a
# short restore rather than a permissions quirk.
docker compose exec mongo mongosh \
  "mongodb://mcrrc:8abc67cad340353f0922891001699268ee8e1ed9c0c13d62@localhost:27017/mcrrcrecords?authSource=admin" \
  --quiet --eval 'db.getCollectionNames().filter(c => !c.startsWith("system.")).forEach(c => print(c, db[c].countDocuments()))'
```

Compare those counts against Atlas. Anything written to Atlas after the dump is
lost, so either accept a short read-only window (`heroku maintenance:on`, dump,
restore, cut over — 15–30 minutes, which is what I would do for a club site) or
run a second delta pass with `mongodump --query`.

The `sessions` collection need not come across, but bringing it means nobody
gets logged out.

### A note on startup ordering

The app does not tolerate an absent database at boot — `service.startUpUpdate()`
runs immediately and its rejection is unhandled, so the process exits:

```
MongooseError: Operation `systeminfos.findOne()` buffering timed out after 10000ms
```

`docker-compose.yml` handles this with `depends_on: mongo: condition:
service_healthy`, so the app waits for a healthy Mongo rather than crashlooping.
A Mongo restart will still take the app down until Docker restarts it. Making
the app survive a database outage is a code change, worth doing later.

---

## 4. DNS and TLS

Lower the TTL on the current record to 300s **at least 24 hours beforehand**.

At cutover, point the A record at the droplet. Caddy obtains the certificate on
the first HTTPS request once DNS resolves — no certbot, no renewal cron. Watch
it happen:

```bash
docker compose logs -f caddy
```

Keep Heroku and Atlas running, paused not deleted, for at least a week. That is
your rollback: nothing here is destructive to the old stack.

---

## 5. Automated deploys

Add three repository secrets and pushes to `master` become deploys:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | droplet IP |
| `DEPLOY_USER` | `root`, or a dedicated deploy user |
| `DEPLOY_SSH_KEY` | private key whose public half is in the droplet's `authorized_keys` |

The workflow then runs `docker compose pull app && docker compose up -d app`
over SSH. Leave the secrets unset and it only publishes the image, and you
deploy by hand with the same two commands.

**Rollback**: set `IMAGE_TAG=sha-<commit>` in `.env` and `docker compose up -d
app`. Every build publishes an immutable `sha-` tag for exactly this.

---

## 6. Backups

`deploy/backup.sh` dumps weekly, keeps five copies locally, uploads to Google
Drive, and fails loudly on a suspiciously small archive:

```bash
crontab -e
# 03:17 UTC every Sunday
# 17 3 * * 0 /opt/mcrrc/backup.sh >> /var/log/mcrrc-backup.log 2>&1
```

A local archive sits on the same droplet as the database, so it does not
survive losing the droplet — which is most of what a backup is for. The Drive
upload is the copy that does. Setup notes are at the top of the script; the
OAuth step needs a machine with a browser, so it cannot be done entirely on the
droplet, and service accounts do not work with a personal Google account.

Run it once by hand before trusting cron — you want to see both the `local
backup ok` and `uploaded to` lines. Then **test a restore**. An untested backup
is a guess.

Optionally add DigitalOcean's weekly droplet backups (+20% of droplet cost) on
top, which cover the whole box rather than just the database.

Also worth a weekly `docker system prune -af` to stop old image layers
accumulating.

---

## 7. Cleanup, once stable

- `heroku-ssl-redirect` dependency and the `process.env.DYNO` block in
  `server.js` — Caddy does the redirect now
- `heroku-postbuild` script in `package.json`
- `.slugignore`, `.openshift/`, and the OpenShift/mLab branches around the
  Mongo connection
- `config/db.js` — dead code, and it contains a syntax error that would throw
  if anything ever required it (`node --check config/db.js` fails)
- Remove `feature/digitalocean` from the trigger list in `deploy.yml`
