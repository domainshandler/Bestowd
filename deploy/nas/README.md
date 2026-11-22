# Bestowd dev API on the home NAS

Runs the API and its own Postgres in Docker on the TerraMaster NAS (`192.168.1.103`, TOS).
This is a dev setup only. Delete this folder when it's no longer used.

The phone or emulator reaches the API at `http://192.168.1.103:3000`. Use the IP: `tnas.local` doesn't resolve everywhere, Android included.

## First start

1. **Docker:** install **Docker Engine** (or Docker Manager) from the TOS App Center.
2. **SSH:** enable it in TOS Control Panel → Terminal & SNMP. The steps below run over SSH.
3. **Copy the repo** to a NAS share, for example `/Volume1/docker/bestowd`.
   - Use a clean copy without `node_modules`. From the repo: `git archive -o bestowd.zip HEAD`, copy the zip to the share, then `unzip bestowd.zip -d bestowd` on the NAS.
4. **Create `.env`:** in `deploy/nas/`, run `cp .env.example .env` and fill it in. `openssl rand -hex 32` gives a value that works for both `JWT_SECRET` and `ENCRYPTION_KEY`.
5. **Start it** from `deploy/nas/`:
   ```
   sudo docker compose up -d --build
   ```
   On TOS versions with the older Compose, use `docker-compose` instead.
   - The first build takes a few minutes.
   - On every start, the API applies database migrations before it starts serving.
6. **Check it** from any device on the Wi-Fi:
   ```
   curl http://192.168.1.103:3000/health
   ```
   It should return `{"status":"ok"}`.

## Day to day

| Task | Command (in `deploy/nas/`) |
|---|---|
| Logs | `sudo docker compose logs -f api` |
| Update after code changes | copy the new code over, then `sudo docker compose up -d --build` |
| Stop | `sudo docker compose down` |
| Wipe the database | `sudo docker compose down -v`, then start again |

The database lives in the `db-data` Docker volume, so it survives restarts and rebuilds.

## The mobile app against the NAS

Build the APK with the NAS address and the Web client ID:

```
dotnet build apps/mobile/Bestowd.Mobile -f net10.0-android \
  -p:BestowdApiUrl=http://192.168.1.103:3000 \
  -p:GoogleWebClientId=772270916348-1b8bf7q85cbb95ras0q8nkfvkuksbcmu.apps.googleusercontent.com
```

Debug builds allow plain `http`. Release builds need `https`.
