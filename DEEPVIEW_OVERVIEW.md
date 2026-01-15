# Deepview Overview

Purpose: Octopus.do-like Alpha that crawls domains (path-depth 1–5) and renders them in React Flow. Jetzt projektfähig: Projekte/Domains, Snapshots pro Quelle (z. B. Crawler), SQLite-Speicher pro Projekt.

## Stack
- Next.js 16 (App Router, TypeScript), Tailwind for minimal styling.
- React Flow for canvas/cards (pan/zoom, custom card node type, step edges).
- Dagre for graph layout.
- Cheerio for HTML parsing, `fetch` for HTTP requests.
- `better-sqlite3` for sync reads/writes in server routes; DB file at `data.sqlite` in project root.

## UX Flow
1) On load: `GET /api/projects` holt Projekliste. Falls vorhanden, das erste Projekt wird geladen via `GET /api/projects/{slug}`; Statuspill bestätigt.
2) Project Switcher oben links: Auswahl/Wechsel; “+ Neues Projekt” legt Projekt + Primärdomain an.
3) Crawl: Domain im Eingabebalken + Tiefe (1–5) → `POST /api/projects/{slug}/crawl`. Ergebnis wird als Snapshot gespeichert und graphisch dargestellt.
4) Expand/collapse: Standard-Sichtbarkeit Tiefe 0–1; ▼ je Knoten; Display-Button (🖥) toggelt “show all”.
5) Layout: Dagre; bei Eltern (Tiefe ≥2) mit >4 sichtbaren Kindern werden Kinder gewrappt; Edges zu Wrapped-Kindern schwarz/transparent; Root + direkte Kinder nie Wrap.
6) Placeholder-Controls bleiben dekorativ; Save/Zoom-Icons ohne Funktion.

## Node/Edge Shape (React Flow)
- Node type: `card`.
- Node `data`: `{ label: string; path?: string; isRoot?: boolean; depth?: number; hasChildren?: boolean; expanded?: boolean; isNew?: boolean; statusCode?: number; unreachable?: boolean }`.
- Root node id: `"root"`, `isRoot: true`, label = hostname.
- Child node ids: `"node-{normalizedPath}"` (normalized path without trailing slash; root `/` wird nicht als Child angelegt).
- Edge ids: `e-{parent}-{child}`, source = parent id, target = child id, step edges (blue), außer Wrapped-Kinder (black/transparent).

## Crawl Behavior (Path Hierarchy + Optional Sitemap)
- Input domain normalized to `https://{host}/`; hosts compared ignoring leading `www.`; follows redirects to adjust host.
- Attempts `/sitemap.xml` or `/sitemap_index.xml`; imports same-host URLs (max 80).
- Fetch pages (up to `MAX_PAGES=80`) honoring `maxDepth` by URL path depth (segment count). Same-host links only.
- Path-based hierarchy: parent path is prefix (`/a/b` -> parent `/a`); edges built from paths, not from first-seen links.
- Titles from `<title>` when available; fallback to last path segment or hostname; truncated to 40 chars with ellipsis.
- Default visible: depth 0–1; deeper levels shown via toggles or “show all”.

## Data Model (SQLite)
- `projects(id, name, slug, settings, createdAt, updatedAt)` — Projekt-Stammdaten.
- `domains(id, projectId, hostname, isPrimary, createdAt)` — Domains pro Projekt.
- `project_features(projectId, feature, enabled, config)` — deklarative Features/Tools.
- `snapshots(id, projectId, domainId, source, schemaVersion, meta, createdAt)` — Snapshot-Metadaten (z. B. Crawler).
- `snapshot_blobs(snapshotId, payload)` — JSON-Payload pro Snapshot (`{domain,nodes,edges}` für Crawler).
- `pages(projectId, domainId, path, latestSnapshotId, title, depth, statusCode, unreachable, meta)` — Normalisierte Pages für künftige Queries.
- `metrics`, `events` — generische Tabellen für Metriken/Events, derzeit nur vorbereitet.
- Legacy-Migration: alte `projects`-Tabelle wird nach `projects_legacy` verschoben und letzte Zeile ins neue Schema importiert.

## API Contracts
- `GET /api/projects` — `{ projects: [{ project, primaryDomain?, latestSnapshot? }] }`
- `POST /api/projects` — Body `{ name, domain, slug?, settings? }` → `{ project, domain }`
- `GET /api/projects/{slug}` — `{ project, domains, features, latestSnapshot? }` (Crawler-Snapshot inkl. Nodes/Edges)
- `POST /api/projects/{slug}/crawl` — Body `{ domain?, depth? }` → `{ project, domain, snapshot, nodes, edges }`
- `GET /api/projects/{slug}/snapshots?source=crawler` — `{ snapshots: Snapshot[] }`
- Compat: `POST /api/crawl` erstellt/benutzt ein Projekt nach Domain, speichert Snapshot; `GET /api/projects/latest` liefert ggf. letzten Crawler-Snapshot.

## Deployment Notes (Coolify / Nixpacks)
- Install: `npm install`
- Build: `npm run build`
- Start: `npm run start -- -H 0.0.0.0 -p 3000`
- Env: `PORT=3000`, `HOSTNAME=0.0.0.0`, `NODE_ENV=production`
- Native build deps for `better-sqlite3`: set `NIXPACKS_PKGS="build-essential python3"` if needed.
- Persistence: mount a volume to `/app/data.sqlite` (or `/app`) to keep crawl results across restarts.
- Egress must be allowed so the server-side crawler can fetch target domains.

## Known Fixes
- Flackern beim Expand/Display: gelöst durch Refs für Expanded/ShowAll, einmalige Graph-Rebuilds ohne Positions-Mischung (siehe `KNOWN_BUGS_AND_FIXES.md`).
