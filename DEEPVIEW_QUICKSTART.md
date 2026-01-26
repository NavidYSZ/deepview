# Deepview Quickstart (for new devs/LLMs)

## Install & Run
- Prereqs: Node 18+, npm.
- `npm install`
- Dev: `npm run dev -- --hostname 0.0.0.0 --port 3000`
- Prod: `npm run build && npm run start -- -H 0.0.0.0 -p 3000`
- Persist DB: mount/keep `data.sqlite` in project root.

## APIs to Know
- `GET/POST /api/projects` — Liste anfordern oder Projekt+Domain anlegen.
- `GET /api/projects/{slug}` — Projekt + Domains/Features + letzter Snapshot (nodes/edges).
- `POST /api/projects/{slug}/crawl` — Body `{ domain?, depth? }` (1–5) → crawlt, speichert Snapshot/Pages.
- `GET /api/projects/{slug}/snapshots?source=crawler` — Snapshot-Metadaten.
- Keywords: `GET/POST /api/projects/{slug}/keywords` — Upload CSV/TSV/XLSX oder Query per `path`/`domain`.
- Suggestions: `GET/POST/DELETE /api/projects/{slug}/suggestions` — metaTitle/metaDescription/h1 pro Pfad.
- Ghost Pages: `GET/POST/PATCH/DELETE /api/projects/{slug}/ghosts` — manuelle Nodes anlegen/positionieren/löschen.
- Compat: `POST /api/crawl` (auto-proj) und `GET /api/projects/latest` (erster gefundener Snapshot).

## Key Files
- UI: `src/app/page.tsx` (Project Switcher, React Flow, Crawl, ShowAll/Expand, Ghosts, Keywords, SEO Suggestions).
- Crawler: `src/lib/crawler.ts` (Pfadtiefe 1–5, same-host, Sitemap, Meta/H1).
- DB: `src/lib/db.ts` (projects/domains/features/snapshots/pages/keywords/suggestions/ghosts + Legacy-Migration).
- Keyword Parsing: `src/lib/keywords.ts` (CSV/TSV/XLSX → Rows).
- API routes: `src/app/api/projects/*`, `src/app/api/crawl/route.ts` (compat), `src/app/api/projects/latest/route.ts` (compat).
- Styles: `src/app/globals.css`.

## Behavior Snapshot
- On load: Projekte laden → erstes Projekt + Snapshot → Graph + Ghosts + Keywords + Suggestions werden gefetched.
- Crawl: Project-scoped Domain/Depth posten, normalisiert Host, speichert Snapshot + Pages, aktualisiert Graph.
- Sichtbarkeit: Tiefe 0–1 default, ▼/🖥 steuern Sichtbarkeit; Dagre + Wrap bei Eltern ≥2 mit >4 Kindern; Ghosts werden mit gerendert.
- SEO/Content: Keywords Upload + Pfad-Liste; Suggestions CRUD für metaTitle/metaDescription/h1 je Node/Pfad.
- Placeholders: Toolbar/Save/Settings dekorativ; Status-Pill liefert Feedback.

## Deployment (Coolify / Nixpacks)
- Install: `npm install`
- Build: `npm run build`
- Start: `npm run start -- -H 0.0.0.0 -p 3000`
- Env: `PORT=3000`, `HOSTNAME=0.0.0.0`, `NODE_ENV=production`
- Add `NIXPACKS_PKGS="build-essential python3"` if build for `better-sqlite3` needs toolchain.
- Egress must be allowed for crawling; persist `data.sqlite` via volume.
