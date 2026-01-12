# Components & Contracts Cheat Sheet

Goal: Full snapshot of what exists, what it consumes/produces, and where it’s used so a fresh LLM can continue without prior context.

## UI Components (src/app/page.tsx)
- **HomePage (default export)**
  - Inputs: data from API (`/api/projects/latest`, `/api/crawl`), local state (domain input, depth, showAll), expand set (ref).
  - Outputs: React Flow nodes/edges (visible subset), API calls on crawl/load, status messages.
  - Uses: React Flow (`nodes`, `edges`, `nodeTypes`, `defaultEdgeOptions`, `Background`), Dagre layout helper, expand/collapse logic, display toggle (🖥).
  - Behavior: On load fetches latest project; crawl posts domain/depth and rebuilds graph; only depth 0–1 visible by default; ▼ toggles deeper nodes; 🖥 shows all; status pill shows transient messages; animation for newly shown cards.

- **CardNode (React Flow node type `card`)**
  - Props/Data: `{ label, path?, isRoot?, depth?, hasChildren?, expanded?, isNew?, onToggle? }`.
  - Outputs: Visual card; optional ▼ button that calls `onToggle` (stopPropagation).
  - Styling: Border color root vs child, triple dots header, label/path text, fade-in on `isNew`.

## Layout / State Helpers (src/app/page.tsx)
- **applyLayout** (callback)
  - Inputs: visible nodes/edges with data.depth.
  - Outputs: positioned nodes/edges using Dagre; wraps children (>4) only for parents at depth ≥2; wrapped-child edges get black/transparent stroke.
  - Notes: Root/direct children never wrap.

- **rebuildGraph** (callback)
  - Inputs: full nodes/edges, `expandedSet`, `viewAll`.
  - Outputs: visible nodes/edges decorated with data flags (`hasChildren`, `expanded`, `isNew`), then laid out.
  - Logic: Visibility = always depth 0–1; deeper only if all parents expanded unless `viewAll`. `isNew` set when node wasn’t visible in previous pass (prevVisibleRef).
  - State handling: Uses refs (`expandedRef`, `showAllRef`, `prevVisibleRef`) to avoid recursive rebuilds/flackern.

## Crawler (src/lib/crawler.ts)
- **normalizeDomain(input: string)** → `string`
  - Ensures https://, strips hash/search, pathname `/`, trims trailing slash.
- **crawlDomain(domain: string, maxDepth?: number = 1)** → `CrawlResult`
  - Inputs: domain (may lack protocol), depth 1–5.
  - Process:
    - Normalize domain; follow redirect host; host match ignores leading `www.`.
    - Try `/sitemap.xml` and `/sitemap_index.xml`; ingest same-host URLs (MAX_PAGES=80).
    - Fetch pages up to depth limit (by URL path segments) and page cap; same-host only.
    - Titles from `<title>`; fallback last path segment/hostname; truncate 40 chars.
    - Hierarchy from path prefixes: parent of `/a/b` is `/a`; root `/` not added as child.
  - Outputs: `{ domain: host, nodes: FlowNode[], edges: FlowEdge[] }`
    - Node ids: `"root"` or `"node-{normalizedPath}"`; Node data: `{ label, path, isRoot?, depth?, hasChildren? }`.
    - Edge ids: `e-{parent}-{child}`, type `step`, blue stroke.
  - Error: Throws on fetch failures; caller handles.

## Persistence (src/lib/db.ts)
- DB file: `data.sqlite` in project root; WAL mode.
- Schema: `projects(id PK, domain TEXT, nodes TEXT, edges TEXT, createdAt TEXT)`.
- **saveProject(domain, nodes, edges)**: Inserts JSON-stringified nodes/edges with timestamp.
- **getLatestProject()**: Returns `{ domain, nodes, edges, createdAt } | null`.

## API Routes
- **POST /api/crawl** (`src/app/api/crawl/route.ts`)
  - Body: `{ domain: string, depth?: number }`
  - Success: `200 { domain, nodes, edges }` (also saves to SQLite).
  - Errors: `400 { error }` missing domain; `500 { error }` on crawl failure.
- **GET /api/projects/latest** (`src/app/api/projects/latest/route.ts`)
  - Success: `200 { project: { domain, nodes, edges, createdAt } | null }`

## Data Contracts
- **FlowNode.data**
  - Fields: `label: string; path?: string; isRoot?: boolean; depth?: number; hasChildren?: boolean; expanded?: boolean; isNew?: boolean; onToggle?: () => void`
  - Type: React Flow node type `"card"`.
- **FlowEdge**
  - Fields: `id: string; source: string; target: string; type?: "step"; style?: stroke settings`
  - Default edge options: step, blue stroke; wrapped children: black/transparent stroke.
- **SQLite row**
  - `{ id, domain, nodes (JSON), edges (JSON), createdAt }`

## Behavior Defaults / Flags
- Visible by default: depths 0–1.
- Show All (🖥): toggles `showAllRef`; when on, all nodes visible; when off, expanded set reset.
- Expand toggle (▼): toggles parent id in `expandedRef`, rebuilds visible graph.
- Wrapping: only for parents depth ≥2 with >4 visible children; wrap rows of 4; edges to wrapped children darkened.
- Animation: `fade-in-up` applied to nodes newly visible.

## Known Fixes (see KNOWN_BUGS_AND_FIXES.md)
- Flackern on expand/display resolved by using refs for expanded/showAll and single rebuild per action; no position mixing.
