# Deepview Quickstart (for new devs/LLMs)

## Install & Run
- Prereqs: Node 18+, npm.
- `npm install`
- Dev: `npm run dev -- --hostname 0.0.0.0 --port 3000`
- Prod: `npm run build && npm run start -- -H 0.0.0.0 -p 3000`
- Persist DB: mount/keep `data.sqlite` in project root.

## APIs to Know
- `GET /api/projects` — Projektliste.
- `POST /api/projects` — Body `{ name, domain }` → legt Projekt + Primärdomain an.
- `GET /api/projects/{slug}` — Projektdetails + letzter Crawler-Snapshot (nodes/edges).
- `POST /api/projects/{slug}/crawl` — Body `{ domain?, depth? }` → crawlt, speichert Snapshot, liefert `{ nodes, edges }`.
- `GET /api/projects/{slug}/snapshots?source=crawler` — Snapshot-Metadaten.
- Compat: `POST /api/crawl` und `GET /api/projects/latest` bleiben als Fallback.

## Key Files
- UI: `src/app/page.tsx` (Project Switcher, React Flow canvas, crawl actions, card node).
- Crawler: `src/lib/crawler.ts` (depth 1–5, same-host links only).
- DB: `src/lib/db.ts` (project/domain/snapshot schema + helpers, legacy migration).
- API routes: `src/app/api/projects/*`, `src/app/api/crawl/route.ts` (compat), `src/app/api/projects/latest/route.ts` (compat).
- Styles: `src/app/globals.css`.

## Behavior Snapshot
- On load: fetch projects list; auto-select first project; status pill indicates result.
- Crawl: posts project-scoped domain/depth, normalizes to root, builds nodes/edges from URL path hierarchy (with sitemap support), saves snapshot automatically.
- Visibility: depth 0–1 shown by default; ▼ toggles deeper nodes; 🖥 shows all.
- Graph: custom `card` nodes, Dagre layout; wrapping of >4 children only for depth ≥2; edges to wrapped children are black/transparent.
- Placeholders: toolbar/save buttons are non-functional; crawl + load/refresh are functional.

## Deployment (Coolify / Nixpacks)
- Install: `npm install`
- Build: `npm run build`
- Start: `npm run start -- -H 0.0.0.0 -p 3000`
- Env: `PORT=3000`, `HOSTNAME=0.0.0.0`, `NODE_ENV=production`
- Add `NIXPACKS_PKGS="build-essential python3"` if build for `better-sqlite3` needs toolchain.
- Egress must be allowed for crawling; persist `data.sqlite` via volume.
