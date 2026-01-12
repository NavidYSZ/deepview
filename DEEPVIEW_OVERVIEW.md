# Deepview Overview

Purpose: Octopus.do-like Alpha that crawls a domain (click depth 1) and renders the root and first-level pages in React Flow. Data is persisted in SQLite so the last crawl can be reloaded.

## Stack
- Next.js 16 (App Router, TypeScript), Tailwind for minimal styling.
- React Flow for the canvas/cards (infinite pan/zoom, custom card node type).
- Cheerio for HTML parsing, `fetch` for HTTP requests.
- `better-sqlite3` for sync reads/writes in server routes; DB file at `data.sqlite` in project root.

## UX Flow
1) On load, `GET /api/projects/latest` runs; if a project exists, the graph and domain are populated and a status pill shows it was loaded.
2) User enters a domain in the bottom floating bar and hits “Crawl”; status resets, button shows loading.
3) `POST /api/crawl` fetches the root page, extracts same-host links (depth 1 only), builds nodes/edges, saves to SQLite, returns the graph. UI updates graph + status.
4) Placeholder controls mimic Octopus.do (save, toolbar, color dots, zoom bar), but only the crawl and load actions are functional in Alpha.

## Node/Edge Shape (React Flow)
- Node type: `card`.
- Node `data`: `{ label: string; path?: string; isRoot?: boolean }`.
- Root node id: `"root"`, `isRoot: true`, label = hostname.
- Child node ids: `"node-{normalizedPath}"` (normalized path without trailing slash; root `/` is skipped).
- Edge ids: `"e-root-{index}"`, source = `"root"`, target = child node id, simple stroke style.

## Crawl Behavior (Click Depth 1)
- Input domain is normalized to `https://{host}/` (protocol forced to input’s or https, hash/search dropped).
- Fetch root page; parse all `<a href>`.
- Skip hashes, mailto/tel, cross-domain links, and duplicates.
- Normalize target path: strip trailing slash, drop search/hash, enforce same protocol/host.
- Skip root `/` as a child. If no children remain, emit a single `"Keine Links gefunden"` node.
- Node label: anchor text trimmed; if empty, fallback to last path segment or “Page”; truncated to 28 chars with ellipsis.

## Data Model (SQLite)
- Table `projects`:
  - `id INTEGER PK AUTOINCREMENT`
  - `domain TEXT NOT NULL` (hostname only)
  - `nodes TEXT NOT NULL` (JSON stringified React Flow nodes)
  - `edges TEXT NOT NULL` (JSON stringified React Flow edges)
  - `createdAt TEXT NOT NULL` (ISO string)
- On startup, table is created if missing; `data.sqlite` is touched if missing to allow mounting a volume.
- Saves occur on each successful crawl; latest project is ordered by `createdAt DESC`.

## API Contracts
- `POST /api/crawl`
  - Body: `{ domain: string }`
  - Success 200: `{ domain: string; nodes: FlowNode[]; edges: FlowEdge[] }`
  - Error 400: `{ error: "Bitte eine Domain angeben." }`
  - Error 500: `{ error: string }` (e.g., fetch failed)
  - Side effect: persists project to SQLite.
- `GET /api/projects/latest`
  - Success 200: `{ project: { domain: string; nodes: FlowNode[]; edges: FlowEdge[]; createdAt: string } | null }`

## Deployment Notes (Coolify / Nixpacks)
- Install: `npm install`
- Build: `npm run build`
- Start: `npm run start -- -H 0.0.0.0 -p 3000`
- Env: `PORT=3000`, `HOSTNAME=0.0.0.0`, `NODE_ENV=production`
- Native build deps for `better-sqlite3`: set `NIXPACKS_PKGS="build-essential python3"` if needed.
- Persistence: mount a volume to `/app/data.sqlite` (or `/app`) to keep crawl results across restarts.
- Egress must be allowed so the server-side crawler can fetch target domains.
