# Deepview Overview

Purpose: Octopus.do-like Alpha that crawls a domain (click depth 1) and renders the root and first-level pages in React Flow. Data is persisted in SQLite so the last crawl can be reloaded.

## Stack
- Next.js 16 (App Router, TypeScript), Tailwind for minimal styling.
- React Flow for canvas/cards (pan/zoom, custom card node type, step edges).
- Dagre for graph layout.
- Cheerio for HTML parsing, `fetch` for HTTP requests.
- `better-sqlite3` for sync reads/writes in server routes; DB file at `data.sqlite` in project root.

## UX Flow
1) On load, `GET /api/projects/latest` hydrates the last project (if any); status pill confirms.
2) User enters a domain in the floating bar and clicks “Crawl”; loading state shown.
3) `POST /api/crawl` fetches root, optional sitemap, normalizes URLs, builds nodes/edges by path hierarchy (not click graph), saves to SQLite, returns the graph.
4) Expand/collapse: Only root + depth-1 visible by default; cards with children have a ▼ toggle to reveal deeper levels. A display button (🖥) toggles “show all” on/off.
5) Layout: Dagre arranges root and children; if a parent below depth 1 has >4 visible children, children wrap in rows of 4, edges to wrapped children are black/transparent; root and its direct children never wrap.
6) Placeholder controls remain non-functional; save/zoom icons are decorative.

## Node/Edge Shape (React Flow)
- Node type: `card`.
- Node `data`: `{ label: string; path?: string; isRoot?: boolean; depth?: number; hasChildren?: boolean; expanded?: boolean }`.
- Root node id: `"root"`, `isRoot: true`, label = hostname.
- Child node ids: `"node-{normalizedPath}"` (normalized path without trailing slash; root `/` is skipped as child).
- Edge ids: `e-{parent}-{child}`, source = parent id, target = child id, step edges (blue), except wrapped children (black/transparent).

## Crawl Behavior (Path Hierarchy + Optional Sitemap)
- Input domain normalized to `https://{host}/`; hosts compared ignoring leading `www.`; follows redirects to adjust host.
- Attempts `/sitemap.xml` or `/sitemap_index.xml`; imports same-host URLs (max 80).
- Fetch pages (up to `MAX_PAGES=80`) honoring `maxDepth` by URL path depth (segment count). Same-host links only.
- Path-based hierarchy: parent path is prefix (`/a/b` -> parent `/a`); edges built from paths, not from first-seen links.
- Titles from `<title>` when available; fallback to last path segment or hostname; truncated to 40 chars with ellipsis.
- Default visible: depth 0–1; deeper levels shown via toggles or “show all”.

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

## Known Fixes
- Flackern beim Expand/Display: gelöst durch Refs für Expanded/ShowAll, einmalige Graph-Rebuilds ohne Positions-Mischung (siehe `KNOWN_BUGS_AND_FIXES.md`).
