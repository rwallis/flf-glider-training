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

## Railway (fulfilling-art)

1. **+ Add → GitHub Repo** → `rwallis/flf-glider-training`
2. Leave root directory blank (repo root)
3. Config file: `railway.json` (default)
4. **Variables:** reference existing Postgres `DATABASE_URL` (share with hotspots)
5. Optional: `GLIDER_IMPORT_PASSWORD`, `GLIDER_DEFAULT_USER=ron`, `DATABASE_SSL=true`
6. **Networking → Generate domain** → open `/healthz` then `/`

## Import Q&A

Order: **CFI-G first**, **Private last**.

CSV:

```csv
topic,question,answer
FOI,What are the four levels of learning?,"Rote, Understanding, Application, Correlation"
```

Use the Import tab, or `POST /api/import`.
