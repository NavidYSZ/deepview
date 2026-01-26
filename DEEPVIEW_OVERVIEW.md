# Deepview Overview (aktuell)

Purpose: Octopus.do-ähnliche Karte, die Domains crawlt (Klicktiefe 1–5), Graph in React Flow rendert, Projekte/Domains/Snapshots in SQLite persistiert und SEO-/Ghost-Daten pro Seite ergänzt.

## Stack
- Next.js 16 (App Router, TypeScript) + React 19 + Tailwind v4.
- React Flow (custom card/ghost nodes) + Dagre-Layout.
- Cheerio + `fetch` zum Crawlen/HTML-Parsing; Sitemap-Support.
- SQLite via `better-sqlite3` (sync in API-Routes); DB `data.sqlite` im Projektroot.

## UX & User Flow
1) Start: `GET /api/projects` → erster Eintrag autogeladen via `GET /api/projects/{slug}` inkl. Snapshot.
2) Project Switcher: Projekte wählen/anlegen (legt Domain + Feature-Flag an).
3) Crawlen: Domain + Tiefe (1–5) → `POST /api/projects/{slug}/crawl`; Snapshot gespeichert, Graph aktualisiert.
4) Sichtbarkeit: Tiefe 0–1 sichtbar; ▼ pro Knoten; 🖥 toggelt “Show all”. Dagre-Layout + Wrap ab Eltern-Tiefe ≥2 mit >4 Kindern.
5) Extras: Ghost Pages (manuelle Nodes) erstellen/positionieren, Keywords hochladen, SEO-Vorschläge pro Pfad anzeigen/erfassen. Sidebars links (Overview/Uploads) und rechts (Page Details/SEO/Keywords).

## Node/Edge Shape (React Flow)
- Node-Typen: `card` (Crawler/Pages) und `ghost` (manuelle Seiten).
- `card` data: `{ label, path?, isRoot?, depth?, hasChildren?, expanded?, isNew?, statusCode?, unreachable?, metaTitle?, metaDescription?, h1?, orderAfter?, isManualPosition? }`.
- `ghost` data: `{ label, path, isGhost: true, isManualPosition?, orderAfter? }`.
- IDs: Root `"root"`, Kinder `node-{normalizedPath}`, Ghost `ghost-{id}`. Edges `e-{parent}-{child}`, Typ smoothstep; Wrapped-Kanten schwarz/transparent.

## Crawl Behavior
- Domain → normalisiert zu `https://{host}/`, strip `www.`, folgt Redirect-Host.
- Sitemaps: `/sitemap.xml` oder `/sitemap_index.xml`, max 80 URLs, nur gleicher Host.
- Fetch bis `MAX_PAGES=80`, Tiefe nach Pfad-Segmenten, gleicher Host. Titel aus `<title>`, Meta (`og:/twitter:/description`), erstes `<h1>`. Markiert `statusCode`/`unreachable` bei Fehlern.
- Pfad-Hierarchie: Elternpfad ist Präfix (`/a/b` → `/a`), fehlende Ahnen werden als 404/unreachable angelegt.

## Data Model (SQLite, vereinfacht)
- Core: `projects`, `domains`, `project_features`, `snapshots`, `snapshot_blobs`, `pages`.
- SEO/Content: `keywords` + `keyword_imports`, `node_suggestions` (metaTitle/metaDescription/h1), `ghost_pages`.
- Prepared: `metrics`, `events`.
- Legacy-Migration: alte `projects` → `projects_legacy`, neuester Eintrag wird übernommen.

## API Contracts (wichtigste)
- Projekte: `GET/POST /api/projects`; `GET /api/projects/{slug}`; `GET /api/projects/{slug}/snapshots`.
- Crawling: `POST /api/projects/{slug}/crawl` (depth/domain optional), speichert Snapshot + Pages; Compat `POST /api/crawl`, `GET /api/projects/latest`.
- Keywords: `GET/POST /api/projects/{slug}/keywords` (Upload CSV/TSV/XLSX).
- Suggestions: `GET/POST/DELETE /api/projects/{slug}/suggestions`.
- Ghosts: `GET/POST/PATCH/DELETE /api/projects/{slug}/ghosts`.

## Deployment Notes (Coolify / Nixpacks)
- Install: `npm install`
- Build: `npm run build`
- Start: `npm run start -- -H 0.0.0.0 -p 3000`
- Env: `PORT=3000`, `HOSTNAME=0.0.0.0`, `NODE_ENV=production`
- Native deps für `better-sqlite3`: `NIXPACKS_PKGS="build-essential python3"` falls nötig.
- Persistence: Volume auf `/app/data.sqlite` (oder `/app`), Egress für Crawler erlauben.

## Known Fixes
- Expand/ShowAll-Flackern gelöst über Refs + single rebuild (siehe `KNOWN_BUGS_AND_FIXES.md`).
