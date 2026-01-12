# Deepview Quickstart (for new devs/LLMs)

## Install & Run
- Prereqs: Node 18+, npm.
- `npm install`
- Dev: `npm run dev -- --hostname 0.0.0.0 --port 3000`
- Prod: `npm run build && npm run start -- -H 0.0.0.0 -p 3000`
- Persist DB: mount/keep `data.sqlite` in project root.

## APIs to Know
- `POST /api/crawl` — Body `{ domain: string }` → crawls depth 1, saves to SQLite, returns `{ domain, nodes, edges }`.
- `GET /api/projects/latest` — Returns last saved graph or `project: null`.
  - Crawl depth uses URL path depth (not click graph); sitemap is ingested when present.

## Key Files
- UI: `src/app/page.tsx` (React Flow canvas, crawl/load actions, card node).
- Crawler: `src/lib/crawler.ts` (depth-1, same-host links only).
- DB: `src/lib/db.ts` (better-sqlite3 setup + helpers).
- API routes: `src/app/api/crawl/route.ts`, `src/app/api/projects/latest/route.ts`.
- Styles: `src/app/globals.css`.

## Behavior Snapshot
- On load: auto-fetch latest project; status pill indicates result.
- Crawl: posts domain, normalizes to root, builds nodes/edges from URL path hierarchy (with sitemap support), saves automatically.
- Visibility: only depth 0–1 shown by default; ▼ toggles deeper nodes; 🖥 shows all.
- Graph: custom `card` nodes, Dagre layout; wrapping of >4 children only for depth ≥2; edges to wrapped children are black/transparent.
- Placeholders: toolbar/save buttons are non-functional; crawl + load are functional.

## Deployment (Coolify / Nixpacks)
- Install: `npm install`
- Build: `npm run build`
- Start: `npm run start -- -H 0.0.0.0 -p 3000`
- Env: `PORT=3000`, `HOSTNAME=0.0.0.0`, `NODE_ENV=production`
- Add `NIXPACKS_PKGS="build-essential python3"` if build for `better-sqlite3` needs toolchain.
- Egress must be allowed for crawling; persist `data.sqlite` via volume.
