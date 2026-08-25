# Migrating from Heroku + Atlas to DigitalOcean + Dokploy

Target: one DigitalOcean droplet running Dokploy, hosting both this app and a
self-hosted MongoDB, with Let's Encrypt TLS via Dokploy's Traefik.

The app writes nothing to disk at runtime — no uploads, no generated files —
so the container is disposable and MongoDB is the only stateful thing in the
system. That makes the database cutover the only step with real risk.

---

## 0. Before you start

Two things in the repo must be dealt with first, or the build will fail on the
server:

- **`package-lock.json` is currently untracked.** The Dockerfile runs
  `npm ci`, which requires it. Commit it, or the GitHub Actions build fails at
  the first step — CI only sees what is committed.
- **`public/libs/` is gitignored** and populated by `bower install`. This is
  handled inside the Dockerfile, but it is why Nixpacks auto-detection is not
  enough on its own.

```bash
git add package-lock.json Dockerfile .dockerignore \
        .github/workflows/deploy.yml doc/DEPLOY_DOKPLOY.md
git commit -m "Add Dokploy deployment config"
```

Also note `.github/workflows/nodejs.yml` still targets Node 10 and 12, neither
of which can run this app. It fires on every push and will fail red alongside
the deploy workflow. Fix or delete it.

Verify the image builds locally before touching any infrastructure:

```bash
docker build -t mcrrc:test .
```

This is the single highest-value check in the whole migration. The build
installs bower packages over git, compiles LESS against Bootstrap 3 sources in
`public/libs`, and runs terser over ~5 MB of JS. If it works here it will work
on the droplet.

---

## 1. Droplet

**Size: 2 vCPU / 4 GB — the $24/mo Regular droplet.** Not the 2 GB. The
container build peaks well above 1 GB (terser over the concatenated bundle,
plus a full devDependency install that includes TensorFlow and sharp), and
self-hosted Mongo wants a working set in RAM alongside it. On 2 GB you will be
fighting OOM kills during deploys.

**Region: NYC or TOR** if your members are Maryland-based — closest to
Montgomery County.

**Image: Ubuntu 24.04 LTS.**

Create it with your SSH key attached, then:

```bash
ssh root@<droplet-ip>

# Swap, as insurance against build-time memory spikes
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Firewall. 3000 is the Dokploy dashboard.
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw allow 3000
ufw --force enable
```

Consider restricting 3000 to your own IP (`ufw allow from <your-ip> to any port
3000`) rather than exposing the dashboard to the internet.

---

## 2. Install Dokploy

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

The installer brings up Docker in Swarm mode, Traefik, and the Dokploy
dashboard. When it finishes, open `http://<droplet-ip>:3000` and create the
admin account **immediately** — the first account to register claims the
instance.

Then create a project (e.g. `mcrrc`) to hold both services below.

---

## 3. MongoDB service

In the project, add a **MongoDB** database. Set a strong root password and note
the database name (`mcrrcrecords`, to match what Heroku was using).

Dokploy will show an **internal connection string** for the service. That is
what the app should use — it resolves over the internal Docker network, so
Mongo never needs a published port. Do **not** expose Mongo externally; if you
need to connect from your laptop, tunnel over SSH:

```bash
ssh -L 27017:localhost:27017 root@<droplet-ip>
```

The connection string will look roughly like:

```
mongodb://mongo:<password>@<service-name>:27017/mcrrcrecords?authSource=admin
```

`authSource=admin` matters — omitting it is the most common cause of an auth
failure that looks like a wrong password.

---

## 4. Application service

The droplet does **not** build the image. `.github/workflows/deploy.yml` builds
it on GitHub's native amd64 runners and pushes to GHCR; Dokploy only pulls and
runs. Two reasons this matters here:

- A 2 GiB / 1 vCPU droplet cannot comfortably run `npm ci` over ~550 MB of
  devDependencies plus terser while Mongo and Dokploy's own control plane are
  resident. That is where OOM kills come from.
- Building locally on Apple Silicon is not an alternative: your Mac is arm64,
  droplets are amd64, and an emulated `--platform linux/amd64` build is
  extremely slow.

### One-time GHCR setup

1. Push to `master` once so the workflow runs and creates the package.
2. On GitHub, open the new package → **Package settings**. Either make it
   public, or keep it private and create a PAT with `read:packages` for Dokploy
   to authenticate with.
3. The image is `ghcr.io/<owner>/<repo>:latest`, lowercased.

### The Dokploy application

Add an **Application** to the same project:

- **Provider**: Docker (an existing image), **not** Git.
- **Image**: `ghcr.io/<owner>/<repo>:latest`
- **Registry credentials**: only if the package is private — GitHub username
  plus the `read:packages` PAT.
- **Port**: `8090` — matches the `PORT` default in the Dockerfile and
  `server.js`.
- **Domain**: your hostname, HTTPS on, Let's Encrypt cert, "redirect to HTTPS"
  enabled. Traefik now owns the redirect that `heroku-ssl-redirect` used to do.

### Closing the loop: auto-deploy

Copy the application's **webhook URL** from the Dokploy UI into a GitHub
repository secret named `DOKPLOY_DEPLOY_WEBHOOK`. The workflow's last step
POSTs to it after a successful push, so a merge to `master` becomes a full
deploy. Leave the secret unset and the workflow still publishes the image — you
just click redeploy in Dokploy yourself, which is a reasonable way to start
while you build confidence in the pipeline.

### Rolling back

Every build also publishes an immutable `sha-<commit>` tag. To roll back, point
the application at that tag instead of `latest` and redeploy. Faster and more
certain than reverting a commit and waiting for a rebuild.

### Environment variables

Copy from `heroku config -a <app>`, with these changes:

| Variable | Value | Note |
|---|---|---|
| `MONGODB_URI` | Dokploy's internal Mongo URL | **New.** Replaces `MONGO_DEV_URL`. Now the first thing `server.js` checks. |
| `TRUST_PROXY_HOPS` | `1` | **New and required.** Without it, all traffic looks like it comes from Traefik and the per-IP rate limits on login, signup and the public application form apply to every user collectively. |
| `SESSION_SECRET` | *(carry over unchanged)* | Changing it logs every member out. |
| `NODE_ENV` | `production` | Set in the Dockerfile; no need to repeat. |
| `SITE_URL` | your new public URL | Used in outbound email links. |
| `BREVO_SMTP_USER` | *(carry over)* | |
| `BREVO_SMTP_KEY` | *(carry over)* | |
| `MCRRC_FROM_EMAIL` | *(carry over)* | |
| `CAPTAINS_EMAIL` | *(carry over)* | |
| `CAPTAINS_EMAIL_COPY` | *(carry over)* | |
| `SEND_EMAIL_FOR_FORM` | *(carry over)* | |
| `PARKRUN_PROXY_URL` | *(carry over)* | |
| `PARKRUN_PROXY_KEY` | *(carry over)* | |
| `SIGNAL_URL` | *(carry over)* | |

Do **not** set `DYNO`, `MLAB_MONGODB_DB_URL` or `OPENSHIFT_MONGODB_DB_URL`.
They are legacy branches in `server.js` and setting any of them would divert
the connection away from `MONGODB_URI`.

Check Brevo for IP-based sending restrictions — the droplet is a new sending
origin, and this is a common post-migration surprise.

---

### Startup ordering — expect a crashloop on first deploy

The app does not tolerate an absent database at boot. `service.startUpUpdate()`
runs immediately on startup and its rejection is unhandled, so with Mongo
unreachable the process exits rather than staying up in a degraded state:

```
MongooseError: Operation `systeminfos.findOne()` buffering timed out after 10000ms
```

Consequences to plan around:

- Start the **Mongo service before the app**, and expect a few failed starts on
  the very first deploy while Mongo initialises. Docker's restart policy
  recovers it; no action needed beyond not panicking at the logs.
- A Mongo restart takes the app down with it until Docker restarts the
  container. Brief, but not seamless.
- The 503 branch of `/api/health` is therefore mostly theoretical — in practice
  the container is either healthy or gone. The healthcheck still does useful
  work by keeping an unhealthy container out of rotation during startup.

Making the app survive a database outage means handling that startup rejection,
which is a code change beyond the scope of the migration. Worth doing later.

## 5. Data migration

Deploy the app **before** migrating data and confirm it starts and reports
`{"status":"degraded"}` or `ok` at `/api/health`. Then move the data.

Dump from Atlas (from the droplet, so the restore is local):

```bash
apt-get install -y mongodb-database-tools

mongodump --uri="<atlas-connection-string>" --archive=/root/atlas.archive --gzip
```

Restore into the Dokploy Mongo container:

```bash
docker ps                                    # find the mongo container name
docker cp /root/atlas.archive <mongo-container>:/tmp/

docker exec -i <mongo-container> mongorestore \
  --uri="mongodb://mongo:<password>@localhost:27017/?authSource=admin" \
  --archive=/tmp/atlas.archive --gzip \
  --nsFrom='mcrrcrecords.*' --nsTo='mcrrcrecords.*'
```

Then verify counts match Atlas before cutting over:

```bash
docker exec -it <mongo-container> mongosh \
  "mongodb://mongo:<password>@localhost:27017/mcrrcrecords?authSource=admin" \
  --eval 'db.getCollectionNames().forEach(c => print(c, db[c].countDocuments()))'
```

**About downtime:** any result, application or signup written to Atlas after
the dump is lost. Two options:

- *Simple* — put Heroku in maintenance mode (`heroku maintenance:on`), dump,
  restore, cut DNS over. Perhaps 15–30 minutes of read-only downtime. This is
  what I would do for a club site.
- *Zero-downtime* — dump, restore, then re-run a second `mongodump --query`
  pass over recently-modified documents. Only worth it if you cannot take the
  window.

The `sessions` collection does not need to come across — members will simply
log in again — but bringing it means nobody gets logged out.

---

## 6. DNS cutover

Lower the TTL on your current DNS record to 300s **at least 24 hours before**
the cutover, so the change propagates quickly when you make it.

At cutover: point the A record at the droplet IP. Wait for Dokploy to issue the
Let's Encrypt certificate (it needs the DNS to resolve first — a cert issued
before propagation will fail).

Keep Heroku and Atlas running for **at least a week**, paused rather than
deleted. They are your rollback.

---

## 7. Backups

Self-hosting means backups are now yours. Set both up on day one, not later:

1. **Dokploy's built-in database backups** — schedule to an S3-compatible
   target. DigitalOcean Spaces works and keeps it on one bill.
2. **Droplet snapshots** — enable weekly automated backups on the droplet
   itself (+20% of droplet cost). Covers the whole box, not just Mongo.

Then actually test a restore. An untested backup is a guess.

---

## 8. Rollback

Because Heroku stays up and Atlas keeps its data, rollback is just pointing DNS
back. Nothing in this migration is destructive to the old stack until you
choose to delete it.

---

## 9. Cleanup, once stable

Leftovers that can go after a few weeks of clean running:

- `heroku-ssl-redirect` dependency and the `process.env.DYNO` block in
  `server.js`
- `heroku-postbuild` script in `package.json` (the Dockerfile does this now)
- `.slugignore`, `.openshift/`, and the OpenShift/mLab branches around the
  Mongo connection
- `config/db.js` — it is dead code and, in fact, contains a syntax error that
  would throw if anything ever required it
- `.github/workflows/nodejs.yml` still targets Node 10 and 12, which cannot run
  this app
