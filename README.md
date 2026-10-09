# FLF Glider Training

Phone-first study app for Fault Line Flyers:

- **Ready now:** Common knowledge, Commercial glider, Schweizer **2-33**
- **Upload later:** CFI-G Q&A, then Private Pilot glider Q&A

## Local

```bash
npm install
npm start
```

Open http://localhost:3400  

Without `DATABASE_URL`, uses in-memory seed (progress resets on restart).

```bash
cp .env.example .env
# set DATABASE_URL
npm start
```

```bash
npm test
```

## Google sign-in

Any Google account can sign in (no email allowlist). Progress is keyed by Google `sub` (`g:…` in `glider_progress.user_key`).

Local without OAuth: leave `AUTH_ENABLED` unset/false — app uses `GLIDER_DEFAULT_USER`.

### Railway variables

| Variable | Value |
|----------|--------|
| `AUTH_ENABLED` | `true` |
| `GOOGLE_CLIENT_ID` | from Google Cloud Console OAuth client |
| `GOOGLE_CLIENT_SECRET` | same |
| `SESSION_SECRET` | long random string |
| `APP_BASE_URL` | `https://flf-glider-training-production.up.railway.app` (no trailing slash) |

In Google Cloud → Credentials → OAuth client, add authorized redirect URI:

`https://flf-glider-training-production.up.railway.app/auth/google/callback`

Login page (`/login`) includes new-user study instructions.

## Railway (fulfilling-art)

1. **+ Add → GitHub Repo** → `rwallis/flf-glider-training`
2. Leave root directory blank (repo root)
3. Config file: `railway.json` (default)
4. **Variables:** reference existing Postgres `DATABASE_URL` (share with hotspots)
5. Set Google OAuth vars above; optional `GLIDER_IMPORT_PASSWORD`, `DATABASE_SSL=true`
6. **Networking → Generate domain** → open `/healthz` then `/` (redirects to `/login` when auth is on)

## Import Q&A

Order: **CFI-G first**, **Private last**.

CSV (open answer or multiple choice):

```csv
topic,question,answer
FOI,What are the four levels of learning?,"Rote, Understanding, Application, Correlation"
```

```csv
Question,Choice A,Choice B,Choice C,Answer Key,Correct Answer
NTSB notification is required when…,landing gear only,engine failure,adversely affects structure,C,adversely affects structure
```

Use the Import tab, or `POST /api/import`.

### Commercial written bank (Google Sheet)

```bash
node scripts/import-commercial-written.mjs
# optional: GLIDER_BASE_URL=... GLIDER_IMPORT_PASSWORD=...
```

Live app: https://flf-glider-training-production.up.railway.app/
